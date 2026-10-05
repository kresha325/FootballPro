/**
 * Normalize marketplace cart lines for createOrder.
 * @param {unknown} products
 * @returns {{ ok: true, quantityByProductId: Record<number, number>, sortedProductIds: number[] } | { ok: false, status: number, msg: string }}
 */
function normalizeOrderCart(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { ok: false, status: 400, msg: 'Shporta është bosh' };
  }
  if (products.length > 50) {
    return { ok: false, status: 400, msg: 'Shporta ka shumë rreshta' };
  }

  const quantityByProductId = {};
  for (const item of products) {
    const pid = Number(item?.productId);
    const q = Number(item?.quantity);
    if (!Number.isInteger(pid) || pid <= 0) {
      return { ok: false, status: 400, msg: 'Produkt i pavlefshëm në shportë' };
    }
    if (!Number.isInteger(q) || q < 1 || q > 99) {
      return { ok: false, status: 400, msg: 'Sasia duhet të jetë nga 1 deri në 99' };
    }
    quantityByProductId[pid] = (quantityByProductId[pid] || 0) + q;
    if (quantityByProductId[pid] > 99) {
      return { ok: false, status: 400, msg: 'Sasia e produktit e kalon limitin' };
    }
  }

  const sortedProductIds = Object.keys(quantityByProductId)
    .map(Number)
    .sort((a, b) => a - b);

  return { ok: true, quantityByProductId, sortedProductIds };
}

module.exports = { normalizeOrderCart };
