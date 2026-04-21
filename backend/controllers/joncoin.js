const sequelize = require('../config/database');
const { User, JonCoinTransaction, WithdrawalRequest } = require('../models');
const { getCompletedLedgerBalance } = require('../utils/joncoinLedger');

const round2 = (n) => Math.round(parseFloat(n || 0) * 100) / 100;

/** Komision në tërheqje (0–25%). Të gjithë përdoruesit që tërheqin paguajnë këtë përqindje nga shuma e kërkuar. */
function getWithdrawCommissionPercent() {
  const raw = parseFloat(process.env.JONCOIN_WITHDRAW_COMMISSION_PERCENT ?? '5');
  if (!Number.isFinite(raw)) return 5;
  return Math.min(25, Math.max(0, raw));
}

/** Shuma e tërheqjeve në pritje (rezervohet nga balanca e disponueshme për withdraw të ri). */
async function getPendingWithdrawTotal(userId, { transaction } = {}) {
  const sum = await JonCoinTransaction.sum('amount', {
    where: { userId, type: 'withdrawal', status: 'pending' },
    transaction,
  });
  return round2(sum || 0);
}

/** Sa JonCoin mund të tërhiqesh / transferohet (ledger minus tërheqje pending). */
async function getSpendableLedgerBalance(userId, opts) {
  const ledger = await getCompletedLedgerBalance(userId, opts);
  const pendingWd = await getPendingWithdrawTotal(userId, opts);
  return round2(ledger - pendingWd);
}

// Transfer JonCoin mes userave
exports.transfer = async (req, res) => {
  try {
    const { toUserId, amount, description } = req.body;
    if (!toUserId || !amount || amount <= 0) return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Nuk mund t’i dërgosh vetes' });

    const spendable = await getSpendableLedgerBalance(req.user.id);
    if (spendable < amount) {
      return res.status(400).json({
        error: 'Nuk ke mjaftueshëm JonCoin të disponueshëm (përfshi tërheqjet në pritje)',
      });
    }

    const fromUser = await User.findByPk(req.user.id);
    const toUser = await User.findByPk(toUserId);
    if (!toUser) return res.status(404).json({ error: 'Marrësi nuk ekziston' });

    fromUser.joncoinBalance = round2(parseFloat(fromUser.joncoinBalance || 0) - parseFloat(amount));
    await fromUser.save();
    toUser.joncoinBalance = round2(parseFloat(toUser.joncoinBalance || 0) + parseFloat(amount));
    await toUser.save();

    await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'spend',
      amount,
      status: 'completed',
      relatedEntityType: 'transfer',
      relatedEntityId: toUserId,
      description: description || `Transfer te userId ${toUserId}`,
    });
    await JonCoinTransaction.create({
      userId: toUserId,
      type: 'reward',
      amount,
      status: 'completed',
      relatedEntityType: 'transfer',
      relatedEntityId: req.user.id,
      description: description || `Marrë nga userId ${req.user.id}`,
    });
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const balance = await getCompletedLedgerBalance(req.user.id);
    return res.json({
      balance,
      withdrawCommissionPercent: getWithdrawCommissionPercent(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await JonCoinTransaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Kërkesë për “blerje” JonCoin (mbushje wallet).
 * Nëse `JONCOIN_AUTO_COMPLETE_PURCHASE=true`, kredito menjëherë (dev / test pa admin).
 */
exports.purchase = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });

    const auto =
      String(process.env.JONCOIN_AUTO_COMPLETE_PURCHASE || '').toLowerCase() === 'true' ||
      String(process.env.JONCOIN_AUTO_COMPLETE_PURCHASE || '') === '1';

    if (auto) {
      const tx = await JonCoinTransaction.create({
        userId: req.user.id,
        type: 'purchase',
        amount,
        status: 'completed',
        description: 'Blerje JonCoin (auto-approved)',
      });
      const user = await User.findByPk(req.user.id);
      if (user) {
        user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) + parseFloat(amount));
        await user.save();
      }
      return res.json({ success: true, transaction: tx, autoCompleted: true });
    }

    const tx = await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'purchase',
      amount,
      status: 'pending',
      description: 'Blerje JonCoin (në pritje të konfirmimit nga admin)',
    });
    return res.json({ success: true, transaction: tx, autoCompleted: false });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.spend = async (req, res) => {
  try {
    const { amount, relatedEntityType, relatedEntityId, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });

    const spendable = await getSpendableLedgerBalance(req.user.id);
    if (spendable < amount) {
      return res.status(400).json({ error: 'Nuk ke mjaftueshëm JonCoin të disponueshëm' });
    }

    const tx = await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'spend',
      amount,
      status: 'pending',
      relatedEntityType,
      relatedEntityId,
      description,
    });
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.reward = async (req, res) => {
  try {
    const { userId, amount, description, relatedEntityType, relatedEntityId } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User nuk u gjet' });
    user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) + parseFloat(amount));
    await user.save();
    const tx = await JonCoinTransaction.create({
      userId,
      type: 'reward',
      amount,
      status: 'completed',
      relatedEntityType,
      relatedEntityId,
      description,
    });
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    const gross = round2(Number(amount));
    if (!Number.isFinite(gross) || gross <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });

    const spendable = await getSpendableLedgerBalance(req.user.id);
    if (spendable < gross) {
      return res.status(400).json({
        error: 'Nuk ke mjaftueshëm JonCoin të disponueshëm (përfshi tërheqjet në pritje)',
      });
    }

    const feePct = getWithdrawCommissionPercent();
    const feeRate = feePct / 100;
    const feeAmount = round2(gross * feeRate);
    const netPayout = round2(gross - feeAmount);
    if (netPayout <= 0) {
      return res.status(400).json({
        error: 'Shuma është shumë e vogël pas komisionit të tërheqjes; rrit shumën ose ul komisionin në server.',
      });
    }

    const withdrawal = await WithdrawalRequest.create({
      userId: req.user.id,
      amount: netPayout.toFixed(2),
      status: 'pending',
    });
    await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'withdrawal',
      amount: gross,
      status: 'pending',
      relatedEntityType: 'withdrawal',
      relatedEntityId: withdrawal.id,
      description:
        feeAmount > 0
          ? `Tërheqje JonCoin (bruto ${gross}, komision ${feePct}%: ${feeAmount}, net ${netPayout})`
          : 'Kërkesë për tërheqje JonCoin',
    });
    return res.json({
      success: true,
      withdrawal,
      commissionPercent: feePct,
      grossAmount: gross,
      feeAmount,
      netPayout,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status i pavlefshëm' });

    const out = await sequelize.transaction(async (transaction) => {
      const tx = await JonCoinTransaction.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!tx) return { code: 404, error: 'Transaksioni nuk u gjet' };
      if (tx.status !== 'pending') {
        return { code: 400, error: 'Transaksioni është procesuar tashmë' };
      }

      tx.status = status;
      await tx.save({ transaction });

      if (status === 'rejected') {
        if (tx.type === 'withdrawal' && tx.relatedEntityType === 'withdrawal' && tx.relatedEntityId) {
          await WithdrawalRequest.update(
            { status: 'rejected' },
            { where: { id: tx.relatedEntityId }, transaction }
          );
        }
        return { tx };
      }

      const user = await User.findByPk(tx.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (user) {
        if (tx.type === 'purchase') {
          user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) + parseFloat(tx.amount));
        } else if (tx.type === 'spend' || tx.type === 'withdrawal') {
          user.joncoinBalance = round2(parseFloat(user.joncoinBalance || 0) - parseFloat(tx.amount));
        }
        await user.save({ transaction });
      }

      if (tx.type === 'withdrawal' && tx.relatedEntityType === 'withdrawal' && tx.relatedEntityId) {
        await WithdrawalRequest.update(
          { status: 'completed' },
          { where: { id: tx.relatedEntityId }, transaction }
        );
      }

      return { tx };
    });

    if (out.code) return res.status(out.code).json({ error: out.error });
    return res.json({ success: true, transaction: out.tx });
  } catch (err) {
    console.error('updateTransactionStatus:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
