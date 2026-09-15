const { Op } = require('sequelize');
const Product = require('../models/Product');

/** Max hours an out-of-stock listing stays without restock before delete. */
const OUT_OF_STOCK_TTL_HOURS = 48;
const OUT_OF_STOCK_TTL_MS = OUT_OF_STOCK_TTL_HOURS * 60 * 60 * 1000;

function parseStock(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Next stock + outOfStockAt when inventory changes.
 * Restock (stock > 0) clears the timer. First hit to 0 starts it; staying at 0 keeps original timestamp.
 */
function nextStockFields(currentStock, currentOutOfStockAt, nextStock) {
  const safe = Math.max(0, parseInt(String(nextStock), 10) || 0);
  if (safe > 0) {
    return { stock: safe, outOfStockAt: null };
  }
  const alreadyMarked = currentOutOfStockAt ? new Date(currentOutOfStockAt) : null;
  const validMarked = alreadyMarked && !Number.isNaN(alreadyMarked.getTime()) ? alreadyMarked : null;
  return {
    stock: 0,
    outOfStockAt: validMarked || new Date(),
  };
}

function expiresAtFrom(outOfStockAt) {
  if (!outOfStockAt) return null;
  const start = new Date(outOfStockAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + OUT_OF_STOCK_TTL_MS);
}

function isOutOfStockExpired(product, now = new Date()) {
  const stockN = parseStock(product?.stock, 0);
  if (stockN == null || stockN > 0) return false;
  const expires = expiresAtFrom(product?.outOfStockAt);
  if (!expires) return false;
  return now.getTime() >= expires.getTime();
}

function hoursLeftUntilExpiry(product, now = new Date()) {
  const expires = expiresAtFrom(product?.outOfStockAt);
  if (!expires) return null;
  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (60 * 60 * 1000));
}

async function purgeExpiredOutOfStockProducts() {
  const cutoff = new Date(Date.now() - OUT_OF_STOCK_TTL_MS);
  const expired = await Product.findAll({
    where: {
      stock: { [Op.lte]: 0 },
      outOfStockAt: { [Op.ne]: null, [Op.lte]: cutoff },
    },
  });
  for (const product of expired) {
    await product.destroy();
  }
  if (expired.length > 0) {
    console.log(`Deleted ${expired.length} out-of-stock product(s) older than ${OUT_OF_STOCK_TTL_HOURS}h.`);
  }
  return expired.length;
}

module.exports = {
  OUT_OF_STOCK_TTL_HOURS,
  OUT_OF_STOCK_TTL_MS,
  parseStock,
  nextStockFields,
  expiresAtFrom,
  isOutOfStockExpired,
  hoursLeftUntilExpiry,
  purgeExpiredOutOfStockProducts,
};
