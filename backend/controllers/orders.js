const { User, Order, JonCoinTransaction } = require('../models');
const { notifySellersOfMarketplaceOrder } = require('../services/marketplaceOrderChat');
const sequelize = require('../config/database');
const {
  checkout,
  settlePendingOrder,
  cancelPendingOrder,
  transitionOrder,
  refundOrder,
  sellerSummary,
} = require('../services/economy/checkout');
const { canAccessOrder } = require('../services/economy/rules');

async function safeOrderNotice(order, actorId) {
  if (!order) return;
  try {
    const { notifyOrderParties } = require('../services/notifications/events');
    await notifyOrderParties(order, { actorId });
  } catch (err) {
    console.warn('order notification:', err?.message || err);
  }
}

async function safeWalletNotice(orderId) {
  try {
    const { notifyWallet } = require('../services/notifications/events');
    const txs = await JonCoinTransaction.findAll({
      where: { relatedEntityId: orderId },
      order: [['id', 'DESC']],
      limit: 6,
    });
    for (const tx of txs) await notifyWallet(tx);
  } catch (err) {
    console.warn('order wallet notification:', err?.message || err);
  }
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

function pageQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
  return { page, limit, offset: (page - 1) * limit };
}

function sendError(res, err, label) {
  const status = err.status || 500;
  if (status === 500) console.error(label, err);
  return res.status(status).json({ msg: err.message || 'Gabim në server' });
}

async function loadVisible(ids) {
  return Order.findAll({
    where: { id: ids },
    include: buyerSellerInclude,
    order: [['id', 'ASC']],
  });
}

exports.getOrders = async (req, res) => {
  try {
    const { page, limit, offset } = pageQuery(req);
    const where = { userId: req.user.id };
    if (req.query.status) where.status = String(req.query.status);
    const result = await Order.findAndCountAll({
      where,
      include: buyerSellerInclude,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const orders = result.rows.map(serializeOrder);
    if (req.query.page) {
      return res.json({ orders, page, limit, total: result.count });
    }
    return res.json(orders);
  } catch (err) {
    console.error('getOrders', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.getSellerOrders = async (req, res) => {
  try {
    const { page, limit, offset } = pageQuery(req);
    const where = { sellerId: req.user.id };
    if (req.query.status) where.status = String(req.query.status);
    const result = await Order.findAndCountAll({
      where,
      include: buyerSellerInclude,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const orders = result.rows.map(serializeOrder);
    if (req.query.page) return res.json({ orders, page, limit, total: result.count });
    return res.json(orders);
  } catch (err) {
    console.error('getSellerOrders', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.getSellerSummary = async (req, res) => {
  try {
    const summary = await sellerSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    sendError(res, err, 'getSellerSummary');
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: buyerSellerInclude });
    if (!order) return res.status(404).json({ msg: 'Porosia nuk u gjet' });
    if (!canAccessOrder(order, req.user)) return res.status(403).json({ msg: 'Nuk ke leje për këtë porosi' });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.createOrder = async (req, res) => {
  const buyerId = req.user?.id;
  if (buyerId == null) return res.status(401).json({ msg: 'Nuk jeni i autentikuar' });
  const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
  try {
    let products = req.body?.products;
    if (!Array.isArray(products) || products.length === 0) {
      const { CartItem } = require('../models');
      const rows = await CartItem.findAll({ where: { userId: buyerId } });
      products = rows.map((row) => ({ productId: row.productId, quantity: row.quantity }));
    }
    const created = await checkout({
      buyerId,
      products,
      deliveryMethod: req.body?.deliveryMethod,
      deliveryAddress: req.body?.deliveryAddress,
      buyerContact: req.body?.buyerContact,
      deliveryNotes: req.body?.deliveryNotes,
      idempotencyKey: idempotencyKey || null,
    });
    const full = await loadVisible(created.orders.map((order) => order.id));
    if (!created.duplicate) {
      for (const order of full) await safeOrderNotice(order, buyerId);
      for (const order of full) await safeWalletNotice(order.id);
      setImmediate(() => {
        for (const order of full) {
          notifySellersOfMarketplaceOrder(sequelize, {
            buyerId,
            orderId: order.id,
            lockedProducts: (order.products || []).map((line) => ({
              product: { id: line.productId, name: line.name },
              quantity: line.quantity,
            })),
            pending: false,
            delivery: {
              method: order.deliveryMethod,
              address: order.deliveryAddress,
              contact: order.buyerContact,
              notes: order.deliveryNotes,
            },
          }).catch((e) => console.error('marketplaceOrderChat', e));
        }
      });
    }
    return res.status(created.duplicate ? 200 : 201).json({
      duplicate: created.duplicate,
      orders: full.map(serializeOrder),
      order: full[0] ? serializeOrder(full[0]) : null,
      msg: created.duplicate
        ? 'Kjo pagesë është regjistruar tashmë.'
        : 'Porosia u pagua me XCoin.',
    });
  } catch (err) {
    return sendError(res, err, 'createOrder');
  }
};

exports.acceptOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId)) return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  try {
    const result = await settlePendingOrder(orderId, req.user);
    const full = await Order.findByPk(result.order.id, { include: buyerSellerInclude });
    if (!result.duplicate) {
      await safeOrderNotice(full, req.user.id);
      await safeWalletNotice(full.id);
    }
    return res.json({
      duplicate: result.duplicate,
      order: serializeOrder(full),
      msg: result.duplicate ? 'Porosia është paguar tashmë.' : 'Porosia u pranua. XCoin u transferuan.',
    });
  } catch (err) {
    return sendError(res, err, 'acceptOrder');
  }
};

exports.rejectOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId)) return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  try {
    const order = await cancelPendingOrder(orderId, req.user);
    const full = await Order.findByPk(order.id, { include: buyerSellerInclude });
    await safeOrderNotice(full, req.user.id);
    return res.json({ order: serializeOrder(full), msg: 'Porosia u anulua. Stoku u kthye.' });
  } catch (err) {
    return sendError(res, err, 'rejectOrder');
  }
};

exports.refundOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId)) return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  try {
    const result = await refundOrder(orderId, req.user);
    const full = await Order.findByPk(result.order.id, { include: buyerSellerInclude });
    if (!result.duplicate) {
      await safeOrderNotice(full, req.user.id);
      await safeWalletNotice(full.id);
    }
    return res.json({
      duplicate: Boolean(result.duplicate),
      order: serializeOrder(full),
      msg: result.duplicate ? 'Porosia është rimbursuar tashmë.' : 'Rimbursimi u krye.',
    });
  } catch (err) {
    return sendError(res, err, 'refundOrder');
  }
};

/** Legacy Stripe confirmation. Marketplace JonCoin orders are settled only by checkout. */
exports.confirmOrder = async (req, res) => {
  return res.status(400).json({
    msg: 'Porositë e tregut paguhen me XCoin përmes POST /api/orders. Statusi i pagesës nuk merret nga klienti.',
  });
};

exports.updateOrderStatus = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '').toLowerCase();
  if (!Number.isFinite(orderId)) return res.status(400).json({ msg: 'Kërkesë e pavlefshme' });
  try {
    const order = await transitionOrder(orderId, status, req.user);
    const full = await Order.findByPk(order.id || orderId, { include: buyerSellerInclude });
    await safeOrderNotice(full, req.user.id);
    res.json(serializeOrder(full));
  } catch (err) {
    return sendError(res, err, 'updateOrderStatus');
  }
};
