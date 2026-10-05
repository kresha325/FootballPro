const sequelize = require('../config/database');
const { JonCoinTransaction, WithdrawalRequest } = require('../models');
const { Op } = require('sequelize');
const {
  getCompletedLedgerBalance,
  getSpendableCents,
  postLedgerEntry,
  finalizePendingEntry,
  lockUsers,
  publicTransaction,
} = require('../services/economy/ledger');
const { TX_FILTERS } = require('../services/economy/rules');
const {
  economyPublicConfig,
  getWithdrawCommissionPercent,
  fromCents,
  toCents,
  joncoinCentsToEurCents,
} = require('../config/economy');
const { stripeLiveReady } = require('../config/payments');

async function safeWallet(tx) {
  if (!tx?.id) return;
  try {
    const { notifyWallet } = require('../services/notifications/events');
    await notifyWallet(tx);
  } catch (err) {
    console.warn('wallet notification:', err?.message || err);
  }
}

function sendError(res, err) {
  const status = err.status || 500;
  if (status === 500) console.error('joncoin:', err);
  return res.status(status).json({ error: err.message || 'Gabim në server' });
}

exports.transfer = async (req, res) => {
  try {
    const toUserId = Number(req.body?.toUserId);
    const amountCents = toCents(req.body?.amount);
    const description = req.body?.description;
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (!Number.isInteger(toUserId) || toUserId <= 0 || amountCents == null || amountCents <= 0) {
      return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    }
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Nuk mund t’i dërgosh vetes' });
    const key = idempotencyKey;
    if (!key) return res.status(400).json({ error: 'Idempotency-Key është i detyrueshëm' });

    const result = await sequelize.transaction(async (transaction) => {
      await lockUsers([req.user.id, toUserId], transaction);
      const spent = await postLedgerEntry(
        {
          userId: req.user.id,
          type: 'spend',
          amountCents,
          status: 'completed',
          idempotencyKey: key ? `transfer:${key}:from` : null,
          relatedEntityType: 'transfer',
          relatedEntityId: toUserId,
          description: description || `Transfer te userId ${toUserId}`,
        },
        transaction
      );
      const received = await postLedgerEntry(
        {
          userId: toUserId,
          type: 'reward',
          amountCents,
          status: 'completed',
          idempotencyKey: key ? `transfer:${key}:to` : null,
          relatedEntityType: 'transfer',
          relatedEntityId: req.user.id,
          description: description || `Marrë nga userId ${req.user.id}`,
        },
        transaction
      );
      return { spent: spent.entry, received: received.entry, duplicate: spent.duplicate };
    });

    await safeWallet(result.spent);
    await safeWallet(result.received);
    return res.json({ success: true, duplicate: result.duplicate });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.getBalance = async (req, res) => {
  try {
    const balance = await getCompletedLedgerBalance(req.user.id);
    const spendableCents = await sequelize.transaction((t) => getSpendableCents(req.user.id, t));
    return res.json({
      balance,
      spendable: Number(fromCents(spendableCents)),
      ...economyPublicConfig(),
      withdrawCommissionPercent: getWithdrawCommissionPercent(),
    });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const filter = String(req.query.filter || 'all');
    const where = { userId: req.user.id };
    if (filter === 'transfers') where.relatedEntityType = 'transfer';
    else if (TX_FILTERS[filter]) where.type = { [Op.in]: TX_FILTERS[filter] };
    else if (filter !== 'all') return res.status(400).json({ error: 'Filtri është i pavlefshëm' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || (req.query.page ? 50 : 200)));
    const result = await JonCoinTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const transactions = result.rows.map(publicTransaction);
    if (req.query.page) {
      return res.json({ transactions, page, limit, total: result.count, filter });
    }
    return res.json(transactions);
  } catch (err) {
    return sendError(res, err);
  }
};

/**
 * Deposit request. Coins are credited only by an admin finalizing the hold,
 * or by a verified Stripe webhook. The request body never credits a balance.
 */
exports.purchase = async (req, res) => {
  try {
    const amountCents = toCents(req.body?.amount);
    if (amountCents == null || amountCents <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key është i detyrueshëm' });
    const result = await sequelize.transaction(async (transaction) => postLedgerEntry(
      {
        userId: req.user.id,
        type: 'purchase',
        amountCents,
        status: 'pending',
        idempotencyKey: idempotencyKey ? `deposit:${req.user.id}:${idempotencyKey}` : null,
        description: 'Blerje XCoin (në pritje të pagesës së verifikuar)',
        relatedEntityType: 'deposit',
      },
      transaction
    ));
    await safeWallet(result.entry);
    return res.json({ success: true, transaction: publicTransaction(result.entry), autoCompleted: false, duplicate: result.duplicate });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.createDepositCheckout = async (req, res) => {
  try {
    if (!stripeLiveReady()) {
      return res.status(503).json({ error: 'Pagesa me kartë nuk është aktive. Kërkesa mbetet për konfirmim.' });
    }
    const amountCents = toCents(req.body?.amount);
    if (amountCents == null || amountCents < 100 || amountCents > 100_000_00) {
      return res.status(400).json({ error: 'Shuma duhet të jetë nga 1.00 deri në 1000.00' });
    }
    const eurCents = joncoinCentsToEurCents(amountCents);
    if (eurCents == null || eurCents < 50) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const base = (process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `${fromCents(amountCents)} XCoin` },
          unit_amount: eurCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'joncoin_deposit',
        userId: String(req.user.id),
        joncoinCents: String(amountCents),
      },
      success_url: `${base}/wallet?deposit=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/wallet?deposit=0`,
    });
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.spend = async (req, res) => {
  try {
    const amountCents = toCents(req.body?.amount);
    if (amountCents == null || amountCents <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key është i detyrueshëm' });
    const result = await sequelize.transaction(async (transaction) => postLedgerEntry(
      {
        userId: req.user.id,
        type: 'spend',
        amountCents,
        status: 'completed',
        idempotencyKey: `spend:${req.user.id}:${idempotencyKey}`,
        relatedEntityType: req.body?.relatedEntityType ? String(req.body.relatedEntityType).slice(0, 64) : null,
        relatedEntityId: Number(req.body?.relatedEntityId) || null,
        description: req.body?.description ? String(req.body.description).slice(0, 255) : 'XCoin spend',
      },
      transaction
    ));
    await safeWallet(result.entry);
    return res.json({ success: true, duplicate: result.duplicate, transaction: publicTransaction(result.entry) });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.reward = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const amountCents = toCents(req.body?.amount);
    if (!Number.isInteger(userId) || userId <= 0 || amountCents == null || amountCents <= 0) {
      return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    }
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    const result = await sequelize.transaction(async (transaction) => postLedgerEntry(
      {
        userId,
        type: 'reward',
        amountCents,
        status: 'completed',
        idempotencyKey: idempotencyKey ? `reward:${idempotencyKey}` : null,
        relatedEntityType: req.body?.relatedEntityType || null,
        relatedEntityId: Number(req.body?.relatedEntityId) || null,
        description: req.body?.description || 'XCoin reward',
      },
      transaction
    ));
    await safeWallet(result.entry);
    return res.json({ success: true, duplicate: result.duplicate, transaction: publicTransaction(result.entry) });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.withdraw = async (req, res) => {
  try {
    const gross = toCents(req.body?.amount);
    if (gross == null || gross <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const feePct = getWithdrawCommissionPercent();
    const { percentOfCents } = require('../utils/money');
    const feeAmount = percentOfCents(gross, feePct) || 0;
    const net = gross - feeAmount;
    if (net <= 0) return res.status(400).json({ error: 'Shuma është shumë e vogël pas komisionit të tërheqjes' });
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key është i detyrueshëm' });

    const result = await sequelize.transaction(async (transaction) => {
      const withdrawal = await WithdrawalRequest.create({
        userId: req.user.id,
        amount: fromCents(net),
        status: 'pending',
      }, { transaction });
      const posted = await postLedgerEntry(
        {
          userId: req.user.id,
          type: 'withdrawal',
          amountCents: gross,
          status: 'pending',
          idempotencyKey: idempotencyKey ? `withdraw:${req.user.id}:${idempotencyKey}` : null,
          relatedEntityType: 'withdrawal',
          relatedEntityId: withdrawal.id,
          description: feeAmount > 0
            ? `Tërheqje XCoin (bruto ${fromCents(gross)}, komision ${feePct}%: ${fromCents(feeAmount)}, net ${fromCents(net)})`
            : 'Kërkesë për tërheqje XCoin',
        },
        transaction
      );
      return { withdrawal, tx: posted.entry, duplicate: posted.duplicate };
    });

    await safeWallet(result.tx);
    return res.json({
      success: true,
      duplicate: result.duplicate,
      withdrawal: result.withdrawal,
      commissionPercent: feePct,
      grossAmount: fromCents(gross),
      feeAmount: fromCents(feeAmount),
      netPayout: fromCents(net),
    });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status i pavlefshëm' });

    const tx = await sequelize.transaction(async (transaction) => {
      const finalized = await finalizePendingEntry(id, status, transaction);
      if (finalized.type === 'withdrawal' && finalized.relatedEntityType === 'withdrawal' && finalized.relatedEntityId) {
        await WithdrawalRequest.update(
          { status: status === 'completed' ? 'completed' : 'rejected' },
          { where: { id: finalized.relatedEntityId }, transaction }
        );
      }
      return finalized;
    });

    await safeWallet(tx);
    if (status === 'completed' && tx.type === 'purchase') {
      try {
        const { createInvoiceIfNeeded } = require('../utils/invoices');
        await createInvoiceIfNeeded({
          userId: tx.userId,
          kind: 'joncoin',
          source: 'admin',
          amount: tx.amount,
          currency: 'EUR',
          description: tx.description || 'Blerje XCoin (admin approved)',
          joncoinAmount: tx.amount,
          externalId: `joncoin-tx:${tx.id}`,
          joncoinTransactionId: tx.id,
        });
      } catch (invErr) {
        console.warn('XCoin admin invoice skipped:', invErr?.message || invErr);
      }
    }
    return res.json({ success: true, transaction: publicTransaction(tx) });
  } catch (err) {
    return sendError(res, err);
  }
};

exports.creditVerifiedDeposit = async function creditVerifiedDeposit({ userId, amountCents, idempotencyKey, description }) {
  return sequelize.transaction(async (transaction) => postLedgerEntry(
    {
      userId,
      type: 'purchase',
      amountCents,
      status: 'completed',
      idempotencyKey,
      description: description || 'XCoin deposit',
      relatedEntityType: 'stripe_checkout',
    },
    transaction
  ));
};
