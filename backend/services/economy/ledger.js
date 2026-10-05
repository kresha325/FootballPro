'use strict';

const sequelize = require('../../config/database');
const { User, JonCoinTransaction } = require('../../models');
const { fromCents, toCents } = require('../../utils/money');
const { CREDIT_TYPES, DEBIT_TYPES, sameIdempotentPayload } = require('./rules');

function economyError(status, message) {
  return Object.assign(new Error(message), { status });
}

function signedCents(type, amountCents) {
  if (CREDIT_TYPES.has(type)) return amountCents;
  if (DEBIT_TYPES.has(type)) return -amountCents;
  throw economyError(400, 'Lloj transaksioni i panjohur');
}

async function completedBalanceCents(userId, transaction) {
  const rows = await JonCoinTransaction.findAll({
    where: { userId, status: 'completed' },
    transaction,
  });
  let total = 0;
  for (const row of rows) {
    const amount = toCents(row.amount);
    if (amount == null || amount < 0) continue;
    if (row.status !== 'completed') continue;
    if (CREDIT_TYPES.has(row.type)) total += amount;
    else if (DEBIT_TYPES.has(row.type)) total -= amount;
  }
  return total;
}

async function pendingWithdrawalCents(userId, transaction) {
  const rows = await JonCoinTransaction.findAll({
    where: { userId, type: 'withdrawal', status: 'pending' },
    transaction,
  });
  return rows.reduce((sum, row) => sum + (toCents(row.amount) || 0), 0);
}

async function getCompletedLedgerBalance(userId, { transaction } = {}) {
  const cents = await completedBalanceCents(userId, transaction);
  return Number(fromCents(cents));
}

async function getSpendableCents(userId, transaction) {
  const ledger = await completedBalanceCents(userId, transaction);
  const held = await pendingWithdrawalCents(userId, transaction);
  return ledger - held;
}

function scheduleWalletCache(transaction, userId, cents) {
  const write = () => {
    const JonCoinWallet = require('../../models/JonCoinWallet');
    return JonCoinWallet.findOne({ where: { userId } })
      .then((row) => {
        if (!row) return null;
        row.balance = fromCents(cents);
        return row.save();
      })
      .catch((err) => {
        console.warn('JonCoinWallet cache skipped:', err?.message || err);
      });
  };
  if (transaction && typeof transaction.afterCommit === 'function') {
    transaction.afterCommit(() => {
      write();
    });
    return;
  }
  return write();
}

/**
 * Append one ledger row and move the cached balance.
 * The caller must already be inside a database transaction.
 * Passing the same idempotency key returns the original row and does not post again.
 */
async function postLedgerEntry(input, transaction) {
  if (!transaction) throw economyError(500, 'Ledger entry requires a database transaction');
  const userId = Number(input.userId);
  const type = String(input.type || '');
  const amountCents = Number(input.amountCents);
  const status = input.status || 'completed';
  const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 191) : null;

  if (!Number.isInteger(userId) || userId <= 0) throw economyError(400, 'Përdorues i pavlefshëm');
  if (!CREDIT_TYPES.has(type) && !DEBIT_TYPES.has(type)) throw economyError(400, 'Lloj transaksioni i pavlefshëm');
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw economyError(400, 'Shuma e pavlefshme');
  if (!['pending', 'completed', 'rejected'].includes(status)) throw economyError(400, 'Status i pavlefshëm');

  const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!user) throw economyError(404, 'Përdoruesi nuk u gjet');

  if (idempotencyKey) {
    const existing = await JonCoinTransaction.findOne({
      where: { idempotencyKey },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      if (!sameIdempotentPayload(existing, { userId, type, amountCents })) {
        throw economyError(409, 'Çelësi i idempotencës është përdorur për një veprim tjetër');
      }
      return { entry: existing, duplicate: true };
    }
  }

  const before = await completedBalanceCents(userId, transaction);
  const isDebit = DEBIT_TYPES.has(type);
  let after = before;

  if (status === 'completed') {
    if (isDebit && !input.allowNegative) {
      const spendable = before - (type === 'withdrawal' ? 0 : await pendingWithdrawalCents(userId, transaction));
      if (amountCents > spendable) throw economyError(400, 'Nuk ke mjaftueshëm XCoin');
    }
    after = before + signedCents(type, amountCents);
    if (after < 0 && !input.allowNegative) throw economyError(400, 'Balanca nuk mund të bëhet negative');
  } else if (status === 'pending' && type === 'withdrawal') {
    const spendable = await getSpendableCents(userId, transaction);
    if (amountCents > spendable) throw economyError(400, 'Nuk ke mjaftueshëm XCoin të disponueshëm');
  } else if (status === 'pending' && isDebit && !input.allowNegative) {
    const spendable = await getSpendableCents(userId, transaction);
    if (amountCents > spendable) throw economyError(400, 'Nuk ke mjaftueshëm XCoin');
  }

  const entry = await JonCoinTransaction.create(
    {
      userId,
      type,
      amount: fromCents(amountCents),
      currency: input.currency || 'JON',
      status,
      balanceBefore: fromCents(before),
      balanceAfter: fromCents(status === 'completed' ? after : before),
      relatedEntityType: input.relatedEntityType || null,
      relatedEntityId: input.relatedEntityId || null,
      description: input.description ? String(input.description).slice(0, 255) : null,
      idempotencyKey,
    },
    { transaction }
  );

  if (status === 'completed') {
    user.joncoinBalance = fromCents(after);
    await user.save({ transaction });
    scheduleWalletCache(transaction, userId, after);
  }

  return { entry, duplicate: false };
}

/**
 * Pending holds become completed or rejected. Amount is never edited.
 * This is the only in-place ledger change, and it finalizes a hold that was already recorded.
 */
async function finalizePendingEntry(id, nextStatus, transaction) {
  if (!['completed', 'rejected'].includes(nextStatus)) throw economyError(400, 'Status i pavlefshëm');
  const tx = await JonCoinTransaction.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!tx) throw economyError(404, 'Transaksioni nuk u gjet');
  if (tx.status !== 'pending') throw economyError(400, 'Transaksioni është procesuar tashmë');

  if (nextStatus === 'rejected') {
    tx.status = 'rejected';
    await tx.save({ transaction });
    return tx;
  }

  const user = await User.findByPk(tx.userId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!user) throw economyError(404, 'Përdoruesi nuk u gjet');
  const amountCents = toCents(tx.amount);
  if (amountCents == null || amountCents <= 0) throw economyError(400, 'Shuma e pavlefshme');

  const before = await completedBalanceCents(tx.userId, transaction);
  const isDebit = DEBIT_TYPES.has(tx.type);
  if (isDebit) {
    const otherHolds = (await pendingWithdrawalCents(tx.userId, transaction)) - (tx.type === 'withdrawal' ? amountCents : 0);
    const spendable = before - Math.max(0, otherHolds);
    if (amountCents > spendable) throw economyError(400, 'Nuk ke mjaftueshëm XCoin');
  }
  const after = before + signedCents(tx.type, amountCents);
  if (after < 0) throw economyError(400, 'Balanca nuk mund të bëhet negative');

  tx.status = 'completed';
  tx.balanceBefore = fromCents(before);
  tx.balanceAfter = fromCents(after);
  await tx.save({ transaction });
  user.joncoinBalance = fromCents(after);
  await user.save({ transaction });
  scheduleWalletCache(transaction, tx.userId, after);
  return tx;
}

async function lockUsers(ids, transaction) {
  const unique = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  const rows = [];
  for (const id of unique) {
    const row = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw economyError(400, 'Përdoruesi nuk u gjet');
    rows.push(row);
  }
  return rows;
}

function publicTransaction(tx) {
  const row = typeof tx.toJSON === 'function' ? tx.toJSON() : { ...tx };
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    amount: row.amount,
    currency: row.currency || 'JON',
    status: row.status,
    balanceBefore: row.balanceBefore == null ? null : row.balanceBefore,
    balanceAfter: row.balanceAfter == null ? null : row.balanceAfter,
    referenceType: row.relatedEntityType || null,
    referenceId: row.relatedEntityId || null,
    description: row.description || null,
    createdAt: row.createdAt,
  };
}

module.exports = {
  sequelize,
  economyError,
  completedBalanceCents,
  pendingWithdrawalCents,
  getCompletedLedgerBalance,
  getSpendableCents,
  postLedgerEntry,
  finalizePendingEntry,
  lockUsers,
  publicTransaction,
};
