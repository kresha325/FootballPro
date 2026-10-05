'use strict';

const { fn, col } = require('sequelize');
const { CREDIT_TYPES, DEBIT_TYPES } = require('../economy/rules');
const { toCents, fromCents } = require('../../utils/money');
const { getCompletedLedgerBalance } = require('../economy/ledger');
const { createdBetween } = require('./formulas');
const { remember, TTL } = require('./cache');

/**
 * Period movement from ledger rows. This is not a balance.
 * Balance is always getCompletedLedgerBalance.
 *
 * purchased = purchase
 * spent     = spend + subscription
 * received  = sale + reward
 * refunds   = refund
 */
function foldWalletRows(rows) {
  const sums = {};
  let transactionCount = 0;
  for (const row of rows || []) {
    const type = String(row.type || '');
    const count = Number(row.count) || 0;
    const cents = toCents(row.total) || 0;
    transactionCount += count;
    if (!sums[type]) sums[type] = { count: 0, cents: 0 };
    sums[type].count += count;
    sums[type].cents += cents;
  }
  const money = (type) => fromCents(sums[type]?.cents || 0);
  const countOf = (type) => sums[type]?.count || 0;
  const receivedCents = (sums.sale?.cents || 0) + (sums.reward?.cents || 0);
  const spentCents = (sums.spend?.cents || 0) + (sums.subscription?.cents || 0);
  return {
    purchased: money('purchase'),
    purchasedCount: countOf('purchase'),
    spent: fromCents(spentCents),
    received: fromCents(receivedCents),
    refunds: money('refund'),
    fees: fromCents((sums.commission?.cents || 0) + (sums.fee?.cents || 0)),
    withdrawals: money('withdrawal'),
    transactionCount,
    byType: Object.entries(sums).map(([type, row]) => ({
      type,
      count: row.count,
      amount: fromCents(row.cents),
      direction: CREDIT_TYPES.has(type) ? 'credit' : DEBIT_TYPES.has(type) ? 'debit' : 'other',
    })),
    source: 'JonCoinTransactions',
    balanceIncluded: false,
  };
}

async function walletAnalytics(userId, range) {
  const key = `wallet-activity:${userId}:${range?.key || 'all'}:${range?.from || ''}`;
  const activity = await remember(key, TTL.walletActivity, async () => {
    const { JonCoinTransaction } = require('../../models');
    const where = { userId, status: 'completed' };
    const between = createdBetween(range);
    if (between) where.createdAt = between;
    const rows = await JonCoinTransaction.findAll({
      where,
      attributes: ['type', [fn('COUNT', col('id')), 'count'], [fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
      group: ['type'],
      raw: true,
    });
    return foldWalletRows(rows);
  });
  const balance = await getCompletedLedgerBalance(userId);
  return {
    balance,
    balanceSource: 'ledger',
    balanceLabel: 'Current ledger balance. Not filtered by the date range.',
    activity,
    currency: 'JON',
  };
}

module.exports = {
  foldWalletRows,
  walletAnalytics,
};
