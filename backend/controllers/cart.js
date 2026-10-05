'use strict';

const { Product, CartItem } = require('../models');
const { quoteLines } = require('../services/economy/checkout');
const { purchaseBlockReason } = require('../services/economy/rules');
const { normalizeOrderCart } = require('../utils/orderCart');

function presentCart(quote) {
  return {
    items: (quote.items || []).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      name: item.name,
      price: item.joncoinPrice,
      eurPrice: item.price,
      imageUrl: item.imageUrl,
      sellerId: item.sellerId,
      maxStock: item.maxStock,
      lineTotal: item.lineTotal,
      purchasable: item.purchasable,
      unavailableReason: item.unavailableReason,
      status: item.status,
    })),
    subtotal: quote.subtotal,
    platformFee: quote.platformFee,
    sellerNet: quote.sellerNet,
    total: quote.total,
    currency: quote.currency,
    feePercent: quote.feePercent,
    feePayer: quote.feePayer,
  };
}

async function loadQuote(userId) {
  const rows = await CartItem.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] });
  if (!rows.length) {
    return presentCart({
      items: [],
      subtotal: '0.00',
      platformFee: '0.00',
      sellerNet: '0.00',
      total: '0.00',
      currency: 'JON',
      feePercent: 0,
      feePayer: 'seller',
    });
  }
  const quote = await quoteLines(rows.map((row) => ({ productId: row.productId, quantity: row.quantity })));
  return presentCart(quote);
}

exports.getCart = async (req, res) => {
  try {
    res.json(await loadQuote(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Gabim në server' });
  }
};

exports.addItem = async (req, res) => {
  try {
    const productId = Number(req.body?.productId);
    const quantity = Number(req.body?.quantity ?? 1);
    const parsed = normalizeOrderCart([{ productId, quantity }]);
    if (!parsed.ok) return res.status(parsed.status).json({ msg: parsed.msg });
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ msg: 'Produkti nuk u gjet' });
    if (Number(product.sellerId) === Number(req.user.id)) {
      return res.status(400).json({ msg: 'Nuk mund ta shtosh produktin tënd' });
    }
    const existing = await CartItem.findOne({ where: { userId: req.user.id, productId } });
    const nextQty = (existing ? existing.quantity : 0) + quantity;
    const reason = purchaseBlockReason(product, nextQty);
    if (reason) return res.status(400).json({ msg: reason });
    if (existing) await existing.update({ quantity: nextQty });
    else await CartItem.create({ userId: req.user.id, productId, quantity });
    res.status(201).json(await loadQuote(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Gabim në server' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ msg: 'Sasia duhet të jetë nga 1 deri në 99' });
    }
    const row = await CartItem.findOne({ where: { userId: req.user.id, productId } });
    if (!row) return res.status(404).json({ msg: 'Artikulli nuk është në shportë' });
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ msg: 'Produkti nuk u gjet' });
    const reason = purchaseBlockReason(product, quantity);
    if (reason) return res.status(400).json({ msg: reason });
    await row.update({ quantity });
    res.json(await loadQuote(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Gabim në server' });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await CartItem.destroy({ where: { userId: req.user.id, productId } });
    res.json(await loadQuote(req.user.id));
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await CartItem.destroy({ where: { userId: req.user.id } });
    res.json(await loadQuote(req.user.id));
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.quote = async (req, res) => {
  try {
    const lines = Array.isArray(req.body?.products) ? req.body.products : null;
    if (!lines) return res.json(await loadQuote(req.user.id));
    const quote = await quoteLines(lines.map((line) => ({ productId: line.productId, quantity: line.quantity })));
    res.json(presentCart(quote));
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Gabim në server' });
  }
};
