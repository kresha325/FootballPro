'use strict';

const { toCents } = require('../../utils/money');

const ORDER_STATUSES = [
  'pending',
  'payment_pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'failed',
];

const PRODUCT_STATUSES = ['draft', 'active', 'out_of_stock', 'paused', 'archived'];

/** Free status updates. Payment settlement is not a free transition into `paid`. */
const STATUS_TRANSITIONS = {
  pending: ['cancelled', 'failed'],
  payment_pending: ['cancelled', 'failed'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: [],
};

const CREDIT_TYPES = new Set(['purchase', 'reward', 'refund', 'sale']);
const DEBIT_TYPES = new Set(['spend', 'withdrawal', 'commission', 'subscription', 'reversal', 'fee']);

const TX_FILTERS = {
  all: null,
  deposits: ['purchase'],
  purchases: ['spend'],
  sales: ['sale'],
  refunds: ['refund'],
  bonuses: ['reward'],
  subscriptions: ['subscription'],
  withdrawals: ['withdrawal'],
  fees: ['commission', 'fee'],
  reversals: ['reversal'],
};

/**
 * Integer reservation. Returns the remaining units when the claim fits.
 * Used for stock counts and JonCoin cents so two claims cannot both pass
 * once a lock has serialized them.
 */
function claimUnits(available, requested) {
  const have = Number(available);
  const need = Number(requested);
  if (!Number.isInteger(need) || need < 1) {
    return { ok: false, reason: 'quantity', available: Number.isInteger(have) ? have : 0 };
  }
  if (!Number.isInteger(have) || have < need) {
    return { ok: false, reason: 'insufficient', available: Number.isInteger(have) ? have : 0 };
  }
  return { ok: true, available: have - need };
}

function purchaseBlockReason(product, quantity) {
  if (!product) return 'Produkti nuk u gjet';
  const status = String(product.status || 'active');
  if (status !== 'active') return 'Produkti nuk është në shitje';
  if (product.acceptsJoncoin === false) return 'Ky produkt nuk shitet me XCoin';
  const unit = toCents(product.price);
  if (unit == null || unit <= 0) return 'Çmimi i produktit është i pavlefshëm';
  const stock = product.stock == null || product.stock === '' ? 0 : parseInt(String(product.stock), 10);
  const claim = claimUnits(Number.isFinite(stock) ? stock : 0, quantity);
  if (!claim.ok) return 'Nuk ka stok të mjaftueshëm';
  return null;
}

function actorFor(order, user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  if (Number(order?.sellerId) === Number(user.id)) return 'seller';
  if (Number(order?.userId) === Number(user.id)) return 'buyer';
  return null;
}

function canAccessOrder(order, user) {
  return actorFor(order, user) != null;
}

function canReadWallet(ownerId, user) {
  return Boolean(user) && Number(ownerId) === Number(user.id);
}

function canManageProduct(product, user) {
  if (!user || !product) return false;
  if (user.role === 'admin') return true;
  return Number(product.sellerId) === Number(user.id);
}

function assertStatusTransition(fromStatus, toStatus, user, order) {
  const from = String(fromStatus || '');
  const to = String(toStatus || '');
  const actor = actorFor(order, user);
  if (!actor) {
    throw Object.assign(new Error('Nuk ke leje për këtë porosi'), { status: 403 });
  }
  if (!STATUS_TRANSITIONS[from] || !STATUS_TRANSITIONS[from].includes(to)) {
    throw Object.assign(new Error('Ky ndryshim statusi nuk lejohet'), { status: 400 });
  }
  if (to === 'refunded' && actor === 'buyer') {
    throw Object.assign(new Error('Vetëm shitësi mund ta rimbursojë porosinë'), { status: 403 });
  }
  if (actor === 'buyer') {
    if (to !== 'cancelled' || !['pending', 'payment_pending'].includes(from)) {
      throw Object.assign(new Error('Mund të anulosh vetëm porosi që nuk janë paguar'), { status: 403 });
    }
  }
  return actor;
}

function canRefund(order, user) {
  try {
    assertStatusTransition(order?.status, 'refunded', user, order);
    return true;
  } catch (_err) {
    return false;
  }
}

function sameIdempotentPayload(existing, { userId, type, amountCents }) {
  if (!existing) return false;
  return (
    Number(existing.userId) === Number(userId) &&
    String(existing.type) === String(type) &&
    toCents(existing.amount) === amountCents
  );
}

function slugifyName(name, id) {
  const base = String(name || 'product')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'product';
  return id ? `${base}-${id}` : base;
}

function isRecognizedSaleStatus(status) {
  return ['paid', 'processing', 'shipped', 'delivered'].includes(String(status || ''));
}

module.exports = {
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  STATUS_TRANSITIONS,
  CREDIT_TYPES,
  DEBIT_TYPES,
  TX_FILTERS,
  claimUnits,
  purchaseBlockReason,
  actorFor,
  canAccessOrder,
  canReadWallet,
  canManageProduct,
  assertStatusTransition,
  canRefund,
  sameIdempotentPayload,
  slugifyName,
  isRecognizedSaleStatus,
};
