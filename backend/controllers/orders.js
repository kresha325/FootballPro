const sequelize = require('../config/database');
const { User, Product, Order, Payment, JonCoinTransaction } = require('../models');
const { notifySellersOfMarketplaceOrder } = require('../services/marketplaceOrderChat');
const { normalizeOrderCart } = require('../utils/orderCart');

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
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!order) return res.status(404).json({ msg: 'Porosia nuk u gjet' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

/**
 * Porosi me JonCoin: zbrit nga blerësi, kredito shitësit, zbrit stokun.
 * Trupi: { products: [{ productId, quantity }] }
 */
exports.createOrder = async (req, res) => {
  const { products } = req.body;
  const buyerId = req.user?.id;

  if (buyerId == null) {
    return res.status(401).json({ msg: 'Nuk jeni i autentikuar' });
  }

  const cart = normalizeOrderCart(products);
  if (!cart.ok) {
    return res.status(cart.status).json({ msg: cart.msg });
  }

  const { quantityByProductId, sortedProductIds } = cart;

  try {
    const { order: result, lockedProducts: lockedList } = await sequelize.transaction(async (t) => {
      const lockedProducts = [];
      let totalAmount = 0;
      const orderLines = [];
      const sellerCredit = {};

      const buyerRow = await User.findByPk(buyerId, { transaction: t });
      if (!buyerRow) {
        throw Object.assign(new Error('Buyer not found'), { status: 400 });
      }

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

        const stockN = product.stock == null || product.stock === '' ? 0 : parseInt(String(product.stock), 10);
        if (!Number.isFinite(stockN) || stockN < quantity) {
          throw Object.assign(new Error('Product not available or insufficient stock'), { status: 400 });
        }

        const unitPrice = Math.round(parseFloat(product.price) * 100) / 100;
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw Object.assign(new Error('Invalid product price'), { status: 400 });
        }

        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        totalAmount += lineTotal;
        orderLines.push({
          productId,
          quantity,
          price: unitPrice,
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

        const seller = await User.findByPk(sellerId, { transaction: t });
        if (seller) {
          seller.joncoinBalance = Math.round((parseFloat(seller.joncoinBalance || 0) + gross) * 100) / 100;
          await seller.save({ transaction: t });
        }
      }

      buyerRow.joncoinBalance = Math.round((parseFloat(buyerRow.joncoinBalance || 0) - totalAmount) * 100) / 100;
      await buyerRow.save({ transaction: t });

      for (const { product, quantity } of lockedProducts) {
        const stockN = product.stock == null || product.stock === '' ? 0 : parseInt(String(product.stock), 10);
        const nextStock = Math.max(0, (Number.isFinite(stockN) ? stockN : 0) - quantity);
        await product.update({ stock: nextStock }, { transaction: t });
      }

      return { order, lockedProducts };
    });

    setImmediate(() => {
      notifySellersOfMarketplaceOrder(sequelize, {
        buyerId,
        orderId: result.id,
        lockedProducts: lockedList,
      }).catch((e) => console.error('marketplaceOrderChat', e));
    });

    const orderJson = result.toJSON ? result.toJSON() : result;
    return res.json({
      order: orderJson,
      msg: 'Order paid with JonCoin',
    });
  } catch (err) {
    const status = err.status || 500;
    const msg = err.message || 'Server error';
    if (status === 500) console.error('createOrder JonCoin:', err && err.message, err);
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
  const status = String(req.body?.status || '').toLowerCase();
  const allowed = new Set(['pending', 'paid', 'shipped', 'delivered', 'cancelled']);
  if (!allowed.has(status)) {
    return res.status(400).json({ msg: 'Status i pavlefshëm' });
  }

  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ msg: 'Order not found' });

    const isAdmin = req.user.role === 'admin';
    const isBuyer = Number(order.userId) === Number(req.user.id);

    if (!isAdmin && !isBuyer) {
      return res.status(403).json({ msg: 'Nuk ke leje për këtë porosi' });
    }

    // Buyers may only cancel their own pending orders
    if (!isAdmin) {
      if (status !== 'cancelled' || order.status !== 'pending') {
        return res.status(403).json({ msg: 'Mund të anulosh vetëm porosi në pritje' });
      }
    }

    await order.update({ status });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
