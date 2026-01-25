// Transfer JonCoin mes userave
exports.transfer = async (req, res) => {
  try {
    const { toUserId, amount, description } = req.body;
    if (!toUserId || !amount || amount <= 0) return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Nuk mund t’i dërgosh vetes' });
    const fromUser = await User.findByPk(req.user.id);
    const toUser = await User.findByPk(toUserId);
    if (!toUser) return res.status(404).json({ error: 'Marrësi nuk ekziston' });
    if (fromUser.joncoinBalance < amount) return res.status(400).json({ error: 'Nuk ke mjaftueshëm JonCoin' });
    // Zbrit nga dërguesi
    fromUser.joncoinBalance = parseFloat(fromUser.joncoinBalance) - parseFloat(amount);
    await fromUser.save();
    // Shto te marrësi
    toUser.joncoinBalance = parseFloat(toUser.joncoinBalance) + parseFloat(amount);
    await toUser.save();
    // Logo transaksionin për të dy
    await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'spend',
      amount,
      status: 'completed',
      relatedEntityType: 'transfer',
      relatedEntityId: toUserId,
      description: description || `Transfer te userId ${toUserId}`
    });
    await JonCoinTransaction.create({
      userId: toUserId,
      type: 'reward',
      amount,
      status: 'completed',
      relatedEntityType: 'transfer',
      relatedEntityId: req.user.id,
      description: description || `Marrë nga userId ${req.user.id}`
    });
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const { User, JonCoinTransaction, WithdrawalRequest } = require('../models');

// Merr balancën e JonCoin për userin e loguar
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    return res.json({ balance: user.joncoinBalance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Merr historikun e transaksioneve
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await JonCoinTransaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    return res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Blerje JonCoin (nga marketplace, status pending)
exports.purchase = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const tx = await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'purchase',
      amount,
      status: 'pending',
      description: 'Blerje JonCoin nga marketplace'
    });
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Shpenzo JonCoin për shërbime/produkte (status pending)
exports.spend = async (req, res) => {
  try {
    const { amount, relatedEntityType, relatedEntityId, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const user = await User.findByPk(req.user.id);
    if (user.joncoinBalance < amount) return res.status(400).json({ error: 'Nuk ke mjaftueshëm JonCoin' });
    const tx = await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'spend',
      amount,
      status: 'pending',
      relatedEntityType,
      relatedEntityId,
      description
    });
    // JonCoin do zbritet vetëm kur të konfirmohet pagesa
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Reward automatik (p.sh. për postbaner)
exports.reward = async (req, res) => {
  try {
    const { userId, amount, description, relatedEntityType, relatedEntityId } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Të dhëna të pavlefshme' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User nuk u gjet' });
    user.joncoinBalance = parseFloat(user.joncoinBalance) + parseFloat(amount);
    await user.save();
    const tx = await JonCoinTransaction.create({
      userId,
      type: 'reward',
      amount,
      status: 'completed',
      relatedEntityType,
      relatedEntityId,
      description
    });
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Kërkesë për tërheqje (withdrawal, status pending)
exports.withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Shuma e pavlefshme' });
    const user = await User.findByPk(req.user.id);
    if (user.joncoinBalance < amount) return res.status(400).json({ error: 'Nuk ke mjaftueshëm JonCoin' });
    // Komision 5%
    const netAmount = (amount * 0.95).toFixed(2);
    const withdrawal = await WithdrawalRequest.create({
      userId: req.user.id,
      amount: netAmount,
      status: 'pending'
    });
    await JonCoinTransaction.create({
      userId: req.user.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      relatedEntityType: 'withdrawal',
      relatedEntityId: withdrawal.id,
      description: 'Kërkesë për tërheqje JonCoin'
    });
    return res.json({ success: true, withdrawal });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Konfirmo/refuzo transaksion ose withdrawal (admin)
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status i pavlefshëm' });
    const tx = await JonCoinTransaction.findByPk(id);
    if (!tx) return res.status(404).json({ error: 'Transaksioni nuk u gjet' });
    tx.status = status;
    await tx.save();
    // Nëse është purchase/withdrawal/spend dhe statusi është completed, përditëso balancën
    if (status === 'completed') {
      const user = await User.findByPk(tx.userId);
      if (tx.type === 'purchase') {
        user.joncoinBalance = parseFloat(user.joncoinBalance) + parseFloat(tx.amount);
      } else if (tx.type === 'spend' || tx.type === 'withdrawal') {
        user.joncoinBalance = parseFloat(user.joncoinBalance) - parseFloat(tx.amount);
      }
      await user.save();
    }
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
