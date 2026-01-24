const JonCoinWallet = require('../models/JonCoinWallet');
const { User } = require('../models');

// Get wallet balance
exports.getBalance = async (req, res) => {
  try {
    const wallet = await JonCoinWallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) return res.json({ balance: 0 });
    res.json({ balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Add coins (admin only)
exports.addCoins = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') return res.status(400).json({ error: 'Invalid input' });
    let wallet = await JonCoinWallet.findOne({ where: { userId } });
    if (!wallet) wallet = await JonCoinWallet.create({ userId, balance: 0 });
    wallet.balance += amount;
    await wallet.save();
    res.json({ balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Transfer coins between users
exports.transferCoins = async (req, res) => {
  try {
    const { toUserId, amount } = req.body;
    if (!toUserId || typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Invalid input' });
    const fromWallet = await JonCoinWallet.findOne({ where: { userId: req.user.id } });
    if (!fromWallet || fromWallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    let toWallet = await JonCoinWallet.findOne({ where: { userId: toUserId } });
    if (!toWallet) toWallet = await JonCoinWallet.create({ userId: toUserId, balance: 0 });
    fromWallet.balance -= amount;
    toWallet.balance += amount;
    await fromWallet.save();
    await toWallet.save();
    res.json({ fromBalance: fromWallet.balance, toBalance: toWallet.balance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
