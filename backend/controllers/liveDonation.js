const LiveDonation = require('../models/LiveDonation');

exports.sendDonation = async (req, res) => {
  try {
    const streamId = Number(req.body?.streamId);
    const amount = Number(req.body?.amount);
    const message = req.body?.message ? String(req.body.message).slice(0, 280) : null;
    if (!Number.isInteger(streamId) || streamId <= 0 || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: 'Donacion i pavlefshëm' });
    }
    // Display-only record. Wallet and JonCoin balances are not changed here.
    const donation = await LiveDonation.create({
      streamId,
      userId: req.user.id,
      amount,
      message,
    });
    res.status(201).json(donation);
  } catch (error) {
    console.error('live donation:', error && error.message);
    res.status(500).json({ error: 'Failed to send donation' });
  }
};

exports.getDonations = async (req, res) => {
  try {
    const { streamId } = req.params;
    const donations = await LiveDonation.findAll({
      where: { streamId },
      order: [['timestamp', 'ASC']],
    });
    res.status(200).json(donations);
  } catch (error) {
    console.error('live donation list:', error && error.message);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
};
