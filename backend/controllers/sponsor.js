const db = require('../models');
const Sponsor = db.Sponsor;

// GET all sponsors for a user
exports.getSponsorsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const sponsors = await Sponsor.findAll({
      where: { userId },
      order: [['startDate', 'DESC']]
    });
    res.json(sponsors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST create sponsor for a user (with file upload)
exports.createSponsor = async (req, res) => {
  console.log('BODY:', req.body);
  console.log('FILE:', req.file);
  try {
    const { userId, name, link, startDate, endDate } = req.body;
    let image = null;
    if (req.file) {
      // Save relative path for frontend access
      image = `/uploads/${req.file.filename}`;
    }
    const sponsor = await Sponsor.create({ userId, name, link, image, startDate, endDate });
    res.status(201).json(sponsor);
  } catch (err) {
    console.error('SPONSOR CREATE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT update sponsor
exports.updateSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link, image, startDate, endDate } = req.body;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });
    await sponsor.update({ name, link, image, startDate, endDate });
    res.json(sponsor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE sponsor
exports.deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await Sponsor.findByPk(id);
    if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });
    await sponsor.destroy();
    res.json({ message: 'Sponsor deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
