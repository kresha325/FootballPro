const { JonCoinTransaction } = require('../models');

/** Balancë nga transaksionet e përfunduara (e njëjta logjikë si GET /api/joncoin/balance). */
async function getCompletedLedgerBalance(userId, { transaction } = {}) {
  const txs = await JonCoinTransaction.findAll({
    where: { userId },
    transaction,
  });
  let balance = 0;
  for (const tx of txs) {
    if (tx.status !== 'completed') continue;
    if (['purchase', 'reward', 'refund'].includes(tx.type)) {
      balance += parseFloat(tx.amount);
    } else if (['spend', 'withdrawal', 'commission'].includes(tx.type)) {
      balance -= parseFloat(tx.amount);
    }
  }
  return Math.round(balance * 100) / 100;
}

module.exports = { getCompletedLedgerBalance };
