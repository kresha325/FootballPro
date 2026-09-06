const sequelize = require('../config/database');
const { User, Product, Order, Payment, JonCoinTransaction } = require('../models');
const { notifySellersOfMarketplaceOrder } = require('../services/marketplaceOrderChat');
const { normalizeOrderCart } = require('../utils/orderCart');

const DELIVERY_METHODS = new Set(['pickup', 'shipping', 'meetup']);

/** Balancë llogaritëse vetëm nga transaksionet e përfunduara. */
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

function userLabel(u) {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || `User #${u.id}`;
}

function serializeOrder(order) {
  if (!order) return order;
  const j = typeof order.toJSON === 'function' ? order.toJSON() : { ...order };
  const buyer = j.buyer || null;
  const seller = j.seller || null;
  return {
    ...j,
    buyerName: userLabel(buyer),
    sellerName: userLabel(seller),
    buyer: buyer
      ? { id: buyer.id, firstName: buyer.firstName, lastName: buyer.lastName, role: buyer.role }
      : undefined,
    seller: seller
      ? { id: seller.id, firstName: seller.firstName, lastName: seller.lastName, role: seller.role }
      : undefined,
  };
}

const buyerSellerInclude = [
  { model: User, as: 'buyer', attributes: ['id', 'firstName', 'lastName', 'role'] },
  { model: User, as: 'seller', attributes: ['id', 'firstName', 'lastName', 'role'] },
];

async function restoreStockForOrder(order, transaction) {
  const lines = Array.isArray(order.products) ? order.products : [];
  for (const item of lines) {
    const productId = item?.productId;
    const quantity = parseInt(String(item?.quantity || 0), 10) || 0;
    if (!productId || quantity < 1) continue;
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) continue;
    const stockN = product.stock == null || product.stock === '' ? 0 : parseInt(String(product.stock), 10);
    const base = Number.isFinite(stockN) ? stockN : 0;
    await product.update({ stock: base + quantity }, { transaction });
  }
}

/**
 * Porositë e blerësit.
 */
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      include: buyerSellerInclude,
      order: [['createdAt', 'DESC']],
    });
    res.json(orders.map(serializeOrder));
  } catch (err) {
    console.error('getOrders', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

/**
 * Porositë ku useri është shitës (për pranim/refuzim).
 */
exports.getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { sellerId: req.user.id },
      include: buyerSellerInclude,
      order: [['createdAt', 'DESC']],
    });
    res.json(orders.map(serializeOrder));
  } catch (err) {
    console.error('getSellerOrders', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: buyerSellerInclude });
    if (!order) return res.status(404).json({ msg: 'Porosia nuk u gjet' });
    const uid = Number(req.user.id);
    const isParty =
      Number(order.userId) === uid ||
      Number(order.sellerId) === uid ||
      req.user.role === 'admin';
    if (!isParty) return res.status(403).json({ msg: 'Nuk ke leje për këtë porosi' });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

/**
 * Krijon porosi në status pending: rezervon stokun, NUK transferon JonCoin.
 * Trupi: { products, deliveryMethod?, deliveryAddress?, buyerContact?, deliveryNotes? }
 * Një porosi për shitës.
 */
exports.createOrder = async (req, res) => {
  const { products, deliveryMethod, deliveryAddress, buyerContact, deliveryNotes } = req.body;
  const buyerId = req.user?.id;

  if (buyerId == null) {
    return res.status(401).json({ msg: 'Nuk jeni i autentikuar' });
  }

  const cart = normalizeOrderCart(products);
  if (!cart.ok) {
    return res.status(cart.status).json({ msg: cart.msg });
  }

  const method = String(deliveryMethod || 'meetup').toLowerCase();
  if (!DELIVERY_METHODS.has(method)) {
    return res.status(400).json({ msg: 'Metoda e dërgesës është e pavlefshme (pickup, shipping, meetup)' });
  }
  if (method === 'shipping' && !String(deliveryAddress || '').trim()) {
    return res.status(400).json({ msg: 'Vendos adresën e dërgesës' });
  }
  if (!String(buyerContact || '').trim()) {
    return res.status(400).json({ msg: 'Vendos kontaktin (telefon ose email) që shitësi të të kontaktojë' });
  }

  const { quantityByProductId, sortedProductIds } = cart;

  try {
    const created = await sequelize.transaction(async (t) => {
      const buyerRow = await User.findByPk(buyerId, { transaction: t });
      if (!buyerRow) {
        throw Object.assign(new Error('Buyer not found'), { status: 400 });
      }

      /** @type {Map<number, { lines: any[], locked: any[], total: number, seller: any }>} */
      const bySeller = new Map();

      for (const productId of sortedProductIds) {
        const quantity = quantityByProductId[productId];
        const product = await Product.findByPk(productId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
          include: [{ model: User, as: 'Seller', attributes: ['id', 'firstName', 'lastName'] }],
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
        const sellerId = product.sellerId;
        if (!bySeller.has(sellerId)) {
          bySeller.set(sellerId, { lines: [], locked: [], total: 0, seller: product.Seller });
        }
        const bucket = bySeller.get(sellerId);
        bucket.lines.push({
          productId,
          quantity,
          price: unitPrice,
          name: product.name || 'Produkt',
          sellerId,
        });
        bucket.locked.push({ product, quantity });
        bucket.total = Math.round((bucket.total + lineTotal) * 100) / 100;
      }

      let grandTotal = 0;
      for (const bucket of bySeller.values()) grandTotal += bucket.total;
      grandTotal = Math.round(grandTotal * 100) / 100;

      const balance = await getCompletedJonCoinBalance(buyerId, { transaction: t });
      if (balance < grandTotal) {
        throw Object.assign(new Error('Insufficient JonCoin balance'), { status: 400 });
      }

      const orders = [];
      const notifyPayload = [];

      for (const [sellerId, bucket] of bySeller) {
        const payment = await Payment.create(
          {
            userId: buyerId,
            amount: bucket.total,
            currency: 'JON',
            description: 'Marketplace order pending seller confirmation',
            status: 'pending',
          },
          { transaction: t }
        );

        const order = await Order.create(
          {
            userId: buyerId,
            sellerId,
            products: bucket.lines,
            totalAmount: bucket.total,
            status: 'pending',
            paymentId: payment.id,
            deliveryMethod: method,
            deliveryAddress: String(deliveryAddress || '').trim() || null,
            buyerContact: String(buyerContact || '').trim(),
            deliveryNotes: String(deliveryNotes || '').trim() || null,
          },
          { transaction: t }
        );

        for (const { product, quantity } of bucket.locked) {
          const stockN = product.stock == null || product.stock === '' ? 0 : parseInt(String(product.stock), 10);
          const nextStock = Math.max(0, (Number.isFinite(stockN) ? stockN : 0) - quantity);
          await product.update({ stock: nextStock }, { transaction: t });
        }

        orders.push(order);
        notifyPayload.push({
          orderId: order.id,
          sellerId,
          lockedProducts: bucket.locked,
          total: bucket.total,
        });
      }

      return { orders, notifyPayload, buyerId };
    });

    setImmediate(() => {
      for (const payload of created.notifyPayload) {
        notifySellersOfMarketplaceOrder(sequelize, {
          buyerId: created.buyerId,
          orderId: payload.orderId,
          lockedProducts: payload.lockedProducts,
          pending: true,
          delivery: {
            method,
            address: String(deliveryAddress || '').trim() || null,
            contact: String(buyerContact || '').trim(),
            notes: String(deliveryNotes || '').trim() || null,
          },
        }).catch((e) => console.error('marketplaceOrderChat', e));
      }
    });

    const ids = created.orders.map((o) => o.id);
    const full = await Order.findAll({
      where: { id: ids },
      include: buyerSellerInclude,
    });

    return res.json({
      orders: full.map(serializeOrder),
      order: full[0] ? serializeOrder(full[0]) : null,
      msg: 'Porosia u dërgua. JonCoin transferohen kur shitësi e pranon.',
    });
  } catch (err) {
    const status = err.status || 500;
    const msg = err.message || 'Server error';
    if (status === 500) console.error('createOrder:', err && err.message, err);
    return res.status(status).json({ msg });
  }
};

/**
 * Shitësi pranon porosinë → transferohen JonCoin, status = paid.
 */
exports.acceptOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const sellerId = req.user?.id;
  if (!Number.isFinite(orderId) || sellerId == null) {
    return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  }

  try {
    const order = await sequelize.transaction(async (t) => {
      const row = await Order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!row) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (Number(row.sellerId) !== Number(sellerId) && req.user.role !== 'admin') {
        throw Object.assign(new Error('Vetëm shitësi mund ta pranojë porosinë'), { status: 403 });
      }
      if (row.status !== 'pending') {
        throw Object.assign(new Error('Porosia nuk është në pritje'), { status: 400 });
      }

      const totalAmount = Math.round(parseFloat(row.totalAmount) * 100) / 100;
      const buyerId = row.userId;

      const balance = await getCompletedJonCoinBalance(buyerId, { transaction: t });
      if (balance < totalAmount) {
        throw Object.assign(
          new Error('Blerësi nuk ka mjaftueshëm JonCoin. Anulo ose prit rimbushje.'),
          { status: 400 }
        );
      }

      const buyerRow = await User.findByPk(buyerId, { transaction: t, lock: t.LOCK.UPDATE });
      const sellerRow = await User.findByPk(row.sellerId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!buyerRow || !sellerRow) {
        throw Object.assign(new Error('User not found'), { status: 400 });
      }

      if (row.paymentId) {
        const payment = await Payment.findByPk(row.paymentId, { transaction: t });
        if (payment) {
          await payment.update(
            { status: 'completed', description: `Marketplace order #${row.id} confirmed` },
            { transaction: t }
          );
        }
      }

      await JonCoinTransaction.create(
        {
          userId: buyerId,
          type: 'spend',
          amount: totalAmount,
          status: 'completed',
          relatedEntityType: 'order',
          relatedEntityId: row.id,
          description: `Marketplace purchase #${row.id}`,
        },
        { transaction: t }
      );

      await JonCoinTransaction.create(
        {
          userId: row.sellerId,
          type: 'reward',
          amount: totalAmount,
          status: 'completed',
          relatedEntityType: 'order_sale',
          relatedEntityId: row.id,
          description: `Sale proceeds order #${row.id}`,
        },
        { transaction: t }
      );

      buyerRow.joncoinBalance = Math.round((parseFloat(buyerRow.joncoinBalance || 0) - totalAmount) * 100) / 100;
      await buyerRow.save({ transaction: t });

      sellerRow.joncoinBalance = Math.round((parseFloat(sellerRow.joncoinBalance || 0) + totalAmount) * 100) / 100;
      await sellerRow.save({ transaction: t });

      await row.update({ status: 'paid', confirmedAt: new Date() }, { transaction: t });
      return row;
    });

    const full = await Order.findByPk(order.id, { include: buyerSellerInclude });
    return res.json({
      order: serializeOrder(full),
      msg: 'Porosia u pranua. JonCoin u transferuan.',
    });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('acceptOrder:', err);
    return res.status(status).json({ msg: err.message || 'Server error' });
  }
};

/**
 * Shitësi refuzon porosinë pending → kthen stokun.
 */
exports.rejectOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const sellerId = req.user?.id;
  if (!Number.isFinite(orderId) || sellerId == null) {
    return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  }

  try {
    const order = await sequelize.transaction(async (t) => {
      const row = await Order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!row) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (Number(row.sellerId) !== Number(sellerId) && req.user.role !== 'admin') {
        throw Object.assign(new Error('Vetëm shitësi mund ta refuzojë porosinë'), { status: 403 });
      }
      if (row.status !== 'pending') {
        throw Object.assign(new Error('Porosia nuk është në pritje'), { status: 400 });
      }

      await restoreStockForOrder(row, t);

      if (row.paymentId) {
        const payment = await Payment.findByPk(row.paymentId, { transaction: t });
        if (payment) await payment.update({ status: 'failed' }, { transaction: t });
      }

      await row.update({ status: 'cancelled' }, { transaction: t });
      return row;
    });

    const full = await Order.findByPk(order.id, { include: buyerSellerInclude });
    return res.json({
      order: serializeOrder(full),
      msg: 'Porosia u refuzua. Stoku u kthye.',
    });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('rejectOrder:', err);
    return res.status(status).json({ msg: err.message || 'Server error' });
  }
};

/** Legacy Stripe PaymentIntent confirmation. */
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
      if (order) await order.update({ status: 'paid', confirmedAt: new Date() });

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
    const updated = await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

      const isAdmin = req.user.role === 'admin';
      const isBuyer = Number(order.userId) === Number(req.user.id);
      const isSeller = Number(order.sellerId) === Number(req.user.id);

      if (!isAdmin && !isBuyer && !isSeller) {
        throw Object.assign(new Error('Nuk ke leje për këtë porosi'), { status: 403 });
      }

      if (!isAdmin) {
        if (isBuyer) {
          if (status !== 'cancelled' || order.status !== 'pending') {
            throw Object.assign(new Error('Mund të anulosh vetëm porosi në pritje'), { status: 403 });
          }
        } else if (isSeller) {
          // Shitësi: shipped/delivered pas paid, ose cancelled via reject endpoint
          if (order.status === 'paid' && (status === 'shipped' || status === 'delivered')) {
            // ok
          } else if (status === 'cancelled' && order.status === 'pending') {
            // ok — same as reject
          } else {
            throw Object.assign(new Error('Status i palejuar për shitësin'), { status: 403 });
          }
        }
      }

      if (status === 'cancelled' && order.status === 'pending') {
        await restoreStockForOrder(order, t);
        if (order.paymentId) {
          const payment = await Payment.findByPk(order.paymentId, { transaction: t });
          if (payment) await payment.update({ status: 'failed' }, { transaction: t });
        }
      }

      await order.update({ status }, { transaction: t });
      return order;
    });

    const full = await Order.findByPk(updated.id, { include: buyerSellerInclude });
    res.json(serializeOrder(full));
  } catch (err) {
    const statusCode = err.status || 500;
    if (statusCode === 500) console.error('updateOrderStatus', err);
    res.status(statusCode).json({ msg: err.message || 'Server error' });
  }
};
