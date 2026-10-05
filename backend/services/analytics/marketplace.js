'use strict';

const { fn, col } = require('sequelize');
const { isRecognizedSaleStatus } = require('../economy/rules');
const { toCents, fromCents } = require('../../utils/money');
const { createdBetween } = require('./formulas');
const { remember, TTL } = require('./cache');

function emptyCurrency(currency) {
  return {
    currency: currency || 'JON',
    orders: 0,
    sales: 0,
    recognizedOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    refundedOrders: 0,
    failedOrders: 0,
    pendingOrders: 0,
    grossCents: 0,
    feeCents: 0,
    netCents: 0,
  };
}

function addMoney(cents, value) {
  const next = toCents(value);
  return cents + (next || 0);
}

/**
 * Fold grouped order rows. Different currencies are never added together.
 * Revenue includes only recognized sale statuses (paid, processing, shipped, delivered).
 * completedOrders means delivered, matching the seller order summary.
 */
function foldStatusAggregates(rows) {
  const byCurrency = {};
  for (const row of rows || []) {
    const currency = row.currency || 'JON';
    if (!byCurrency[currency]) byCurrency[currency] = emptyCurrency(currency);
    const bucket = byCurrency[currency];
    const count = Number(row.orders) || 0;
    const status = String(row.status || '');
    bucket.orders += count;
    if (isRecognizedSaleStatus(status)) {
      bucket.sales += count;
      bucket.recognizedOrders += count;
      if (status === 'delivered') bucket.completedOrders += count;
      bucket.grossCents = addMoney(bucket.grossCents, row.gross);
      bucket.feeCents = addMoney(bucket.feeCents, row.fees);
      bucket.netCents = addMoney(bucket.netCents, row.net);
    } else if (status === 'cancelled') bucket.cancelledOrders += count;
    else if (status === 'refunded') bucket.refundedOrders += count;
    else if (status === 'failed') bucket.failedOrders += count;
    else bucket.pendingOrders += count;
  }
  const currencies = Object.values(byCurrency).sort((a, b) => b.recognizedOrders - a.recognizedOrders || b.orders - a.orders);
  const primary = currencies[0] || emptyCurrency('JON');
  const present = (cents, orders) => (orders > 0 ? fromCents(cents) : fromCents(0));
  const shape = (bucket) => ({
    currency: bucket.currency,
    orders: bucket.orders,
    sales: bucket.sales,
    recognizedOrders: bucket.recognizedOrders,
    completedOrders: bucket.completedOrders,
    cancelledOrders: bucket.cancelledOrders,
    refundedOrders: bucket.refundedOrders,
    failedOrders: bucket.failedOrders,
    pendingOrders: bucket.pendingOrders,
    grossRevenue: present(bucket.grossCents, bucket.recognizedOrders),
    platformFees: present(bucket.feeCents, bucket.recognizedOrders),
    netRevenue: present(bucket.netCents, bucket.recognizedOrders),
    averageOrderValue:
      bucket.recognizedOrders > 0 ? fromCents(Math.round(bucket.grossCents / bucket.recognizedOrders)) : null,
  });
  return {
    primaryCurrency: primary.currency,
    mixedCurrency: currencies.length > 1,
    ...shape(primary),
    byCurrency: currencies.map(shape),
    source: 'Orders',
  };
}

async function aggregateSellerOrders(sellerId, range) {
  const Order = require('../../models/Order');
  const where = { sellerId };
  const between = createdBetween(range);
  if (between) where.createdAt = between;
  const rows = await Order.findAll({
    where,
    attributes: [
      'status',
      'currency',
      [fn('COUNT', col('id')), 'orders'],
      [fn('COALESCE', fn('SUM', fn('COALESCE', col('grossAmount'), col('totalAmount'))), 0), 'gross'],
      [fn('COALESCE', fn('SUM', col('platformFeeAmount')), 0), 'fees'],
      [fn('COALESCE', fn('SUM', fn('COALESCE', col('sellerNetAmount'), col('totalAmount'))), 0), 'net'],
    ],
    group: ['status', 'currency'],
    raw: true,
  });
  return foldStatusAggregates(rows);
}

async function marketplaceAnalytics(sellerId, range) {
  const key = `market:${sellerId}:${range?.key || 'all'}:${range?.from || ''}`;
  return remember(key, TTL.marketplace, async () => {
    const Product = require('../../models/Product');
    const [orders, products, activeProducts] = await Promise.all([
      aggregateSellerOrders(sellerId, range),
      Product.count({ where: { sellerId } }),
      Product.count({ where: { sellerId, status: 'active' } }),
    ]);
    return {
      catalog: {
        products,
        activeProducts,
        cumulative: true,
        label: 'Current catalog. Not filtered by the date range.',
      },
      orders,
      unsupported: ['productViews'],
      unsupportedReason: 'The product catalog does not record product view events.',
    };
  });
}

module.exports = {
  foldStatusAggregates,
  aggregateSellerOrders,
  marketplaceAnalytics,
};
