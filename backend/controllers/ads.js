const { Ad } = require('../models');

// GET all active ads
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();
    const ads = await Ad.findAll({
      where: {
        startDate: { [require('sequelize').Op.lte]: now },
        endDate: { [require('sequelize').Op.gte]: now },
      },
      order: [['createdAt', 'DESC']],
    });
    res.json(ads);
  } catch (err) {
    console.error('❌ Error in getActiveAds:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// POST create ad
exports.createAd = async (req, res) => {
  try {
    const { title, text, color, days } = req.body;
    if (!title || !text || !days) return res.status(400).json({ error: 'Missing fields' });
    const now = new Date();
    const startDate = now; // fillon nga momenti i krijimit
    const endDate = new Date(startDate.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    const ad = await Ad.create({
      title,
      text,
      color: color || '#34d399',
      startDate,
      endDate,
      imageUrl,
    });
    res.status(201).json(ad);
  } catch (err) {
    console.error('❌ Error in createAd:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
