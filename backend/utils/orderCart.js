/**
 * Normalize marketplace cart lines for createOrder.
 * @param {unknown} products
 * @returns {{ ok: true, quantityByProductId: Record<number, number>, sortedProductIds: number[] } | { ok: false, status: number, msg: string }}
 */
function normalizeOrderCart(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { ok: false, status: 400, msg: 'Shporta është bosh' };
  }

  const quantityByProductId = {};
  for (const item of products) {
    const pid = Number(item?.productId);
    const q = Math.max(1, parseInt(item?.quantity, 10) || 1);
    if (!Number.isFinite(pid) || pid <= 0) {
      return { ok: false, status: 400, msg: 'Produkt i pavlefshëm në shportë' };
    }
    quantityByProductId[pid] = (quantityByProductId[pid] || 0) + q;
  }

  const sortedProductIds = Object.keys(quantityByProductId)
    .map(Number)
    .sort((a, b) => a - b);

  return { ok: true, quantityByProductId, sortedProductIds };
}

module.exports = { normalizeOrderCart };
