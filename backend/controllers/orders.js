const sequelize = require('../config/database');
const { User, Product, Order, Payment, JonCoinTransaction } = require('../models');

/** Balancë llogaritëse vetëm nga transaksionet e përfunduara (përdoret për blerje marketplace). */
async function getCompletedJonCoinBalance(userId, { transaction } = {}) {
  const txs = await JonCoinTransaction.findAll({
    where: { userId },
    transaction,
  });
  let balance = 0;
  for (const tx of txs) {
    if (tx.status !== 'completed') continue;
    if (['purchase', 'reward', 'refund'].includes(tx.type)) {
      balance += parseFloat(tx.amount);
    } else if (['spend', 'withdrawal', 'commission'].includes(tx.type)) {
      balance -= parseFloat(tx.amount);
    }
  }
  return Math.round(balance * 100) / 100;
}

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { userId: req.user.id } });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Porosi me JonCoin: zbrit nga blerësi, kredito shitësit, zbrit stokun.
 * Trupi: { products: [{ productId, quantity }] }
 */
exports.createOrder = async (req, res) => {
  const { products } = req.body;
  const buyerId = req.user.id;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ msg: 'Cart is empty' });
  }

  const quantityByProductId = {};
  for (const item of products) {
    const pid = Number(item.productId);
    const q = Math.max(1, parseInt(item.quantity, 10) || 1);
    if (!Number.isFinite(pid) || pid <= 0) {
      return res.status(400).json({ msg: 'Invalid product in cart' });
    }
    quantityByProductId[pid] = (quantityByProductId[pid] || 0) + q;
  }

  const sortedProductIds = Object.keys(quantityByProductId)
    .map(Number)
    .sort((a, b) => a - b);

  try {
    const result = await sequelize.transaction(async (t) => {
      const lockedProducts = [];
      let totalAmount = 0;
      const orderLines = [];
      const sellerCredit = {};

      for (const productId of sortedProductIds) {
        const quantity = quantityByProductId[productId];
        const product = await Product.findByPk(productId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!product) {
          throw Object.assign(new Error('Product not found'), { status: 404 });
        }
        if (product.sellerId === buyerId) {
          throw Object.assign(new Error('You cannot buy your own listing'), { status: 400 });
        }
        if (product.stock < quantity) {
          throw Object.assign(new Error('Product not available or insufficient stock'), { status: 400 });
        }

        const lineTotal = Math.round(parseFloat(product.price) * quantity * 100) / 100;
        totalAmount += lineTotal;
        orderLines.push({
          productId,
          quantity,
          price: product.price,
        });
        sellerCredit[product.sellerId] = (sellerCredit[product.sellerId] || 0) + lineTotal;
        lockedProducts.push({ product, quantity });
      }

      totalAmount = Math.round(totalAmount * 100) / 100;

      const balance = await getCompletedJonCoinBalance(buyerId, { transaction: t });
      if (balance < totalAmount) {
        throw Object.assign(new Error('Insufficient JonCoin balance'), { status: 400 });
      }

      const payment = await Payment.create(
        {
          userId: buyerId,
          amount: totalAmount,
          currency: 'JON',
          description: 'Marketplace order (JonCoin)',
          status: 'completed',
        },
        { transaction: t }
      );

      const order = await Order.create(
        {
          userId: buyerId,
          products: orderLines,
          totalAmount,
          status: 'paid',
          paymentId: payment.id,
        },
        { transaction: t }
      );

      await JonCoinTransaction.create(
        {
          userId: buyerId,
          type: 'spend',
          amount: totalAmount,
          status: 'completed',
          relatedEntityType: 'order',
          relatedEntityId: order.id,
          description: `Marketplace purchase #${order.id}`,
        },
        { transaction: t }
      );

      for (const [sellerIdStr, grossStr] of Object.entries(sellerCredit)) {
        const sellerId = Number(sellerIdStr);
        const gross = Math.round(parseFloat(grossStr) * 100) / 100;
        if (gross <= 0) continue;

        await JonCoinTransaction.create(
          {
            userId: sellerId,
            type: 'reward',
            amount: gross,
            status: 'completed',
            relatedEntityType: 'order_sale',
            relatedEntityId: order.id,
            description: `Sale proceeds order #${order.id}`,
          },
          { transaction: t }
        );

        const seller = await User.findByPk(sellerId, { transaction: t, lock: t.LOCK.UPDATE });
        if (seller) {
          seller.joncoinBalance = Math.round((parseFloat(seller.joncoinBalance || 0) + gross) * 100) / 100;
          await seller.save({ transaction: t });
        }
      }

      const buyer = await User.findByPk(buyerId, { transaction: t, lock: t.LOCK.UPDATE });
      if (buyer) {
        buyer.joncoinBalance = Math.round((parseFloat(buyer.joncoinBalance || 0) - totalAmount) * 100) / 100;
        await buyer.save({ transaction: t });
      }

      for (const { product, quantity } of lockedProducts) {
        await product.update({ stock: product.stock - quantity }, { transaction: t });
      }

      return order;
    });

    const orderJson = result.toJSON ? result.toJSON() : result;
    return res.json({
      order: orderJson,
      msg: 'Order paid with JonCoin',
    });
  } catch (err) {
    const status = err.status || 500;
    const msg = err.message || 'Server error';
    if (status === 500) console.error('createOrder JonCoin:', err);
    return res.status(status).json({ msg });
  }
};

/** Legacy Stripe PaymentIntent confirmation — mbetet për porosi të vjetra nëse ekzistojnë. */
exports.confirmOrder = async (req, res) => {
  const { paymentIntentId } = req.body;
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
    const stripe = require('stripe')(stripeKey);
    const payment = await Payment.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      await payment.update({ status: 'completed' });
      const order = await Order.findOne({ where: { paymentId: payment.id } });
      if (order) await order.update({ status: 'paid' });

      if (order && order.products) {
        for (const item of order.products) {
          const product = await Product.findByPk(item.productId);
          if (product) await product.update({ stock: product.stock - item.quantity });
        }
      }

      return res.json({ msg: 'Order confirmed' });
    }
    return res.status(400).json({ msg: 'Payment not successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const order = await Order.findOne({ where: { id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    await order.update({ status });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
