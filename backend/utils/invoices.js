const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Invoice = require('../models/Invoice');

async function nextInvoiceNumber({ transaction } = {}) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `XT-${day}-`;
  const count = await Invoice.count({
    where: { invoiceNumber: { [Op.like]: `${prefix}%` } },
    transaction,
  });
  return `${prefix}${String(count + 1).padStart(5, '0')}`;
}

/**
 * Idempotent invoice create. Prefer matching source+externalId.
 */
async function createInvoiceIfNeeded(payload = {}) {
  const {
    userId,
    kind,
    source,
    amount = 0,
    currency = 'EUR',
    description = null,
    plan = null,
    productId = null,
    joncoinAmount = null,
    externalId = null,
    paymentId = null,
    iapPurchaseId = null,
    joncoinTransactionId = null,
    status = 'completed',
    rawPayload = null,
  } = payload;

  if (!userId || !kind || !source) {
    throw new Error('createInvoiceIfNeeded: userId, kind, source required');
  }

  const resolvedExternal =
    externalId != null && String(externalId).trim()
      ? String(externalId).trim().slice(0, 191)
      : joncoinTransactionId
        ? `joncoin-tx:${joncoinTransactionId}`
        : null;

  if (resolvedExternal) {
    const existing = await Invoice.findOne({
      where: { source, externalId: resolvedExternal },
    });
    if (existing) return { invoice: existing, created: false };
  } else if (joncoinTransactionId) {
    const existing = await Invoice.findOne({ where: { joncoinTransactionId } });
    if (existing) return { invoice: existing, created: false };
  }

  const run = async (transaction) => {
    const invoiceNumber = await nextInvoiceNumber({ transaction });
    try {
      const invoice = await Invoice.create(
        {
          invoiceNumber,
          userId,
          kind,
          source,
          status,
          amount,
          currency,
          description,
          plan,
          productId,
          joncoinAmount,
          externalId: resolvedExternal,
          paymentId,
          iapPurchaseId,
          joncoinTransactionId,
          rawPayload,
        },
        { transaction }
      );
      return { invoice, created: true };
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError' && resolvedExternal) {
        const existing = await Invoice.findOne({
          where: { source, externalId: resolvedExternal },
          transaction,
        });
        if (existing) return { invoice: existing, created: false };
      }
      throw err;
    }
  };

  if (payload.transaction) {
    return run(payload.transaction);
  }
  return sequelize.transaction((transaction) => run(transaction));
}

module.exports = {
  createInvoiceIfNeeded,
  nextInvoiceNumber,
};
