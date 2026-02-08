const LiveDonation = require('../models/LiveDonation');

exports.sendDonation = async (req, res) => {
  try {
    const { streamId, userId, amount, message } = req.body;
    const donation = await LiveDonation.create({ streamId, userId, amount, message });
    res.status(201).json(donation);
  } catch (error) {
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
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
};
