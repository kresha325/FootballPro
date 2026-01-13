const Liga = require('../models/Liga');
const User = require('../models/User');

// Create Liga profile
exports.createLiga = async (req, res) => {
  try {
    if (req.user.role !== 'liga') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingLiga = await Liga.findOne({ where: { userId: req.user.id } });
    if (existingLiga) {
      return res.status(400).json({ msg: 'Liga profile already exists' });
    }
    const liga = await Liga.create({
      userId: req.user.id,
      name: req.body.name,
      logo: req.body.logo,
      country: req.body.country,
      level: req.body.level,
      foundedYear: req.body.foundedYear,
      description: req.body.description,
      website: req.body.website,
      clubs: req.body.clubs,
      competitions: req.body.competitions,
      contact: req.body.contact,
      socialLinks: req.body.socialLinks,
    });
    res.status(201).json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get Liga profile by userId
exports.getLiga = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const liga = await Liga.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!liga) {
      return res.status(404).json({ msg: 'Liga profile not found' });
    }
    res.json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Liga profile
exports.updateLiga = async (req, res) => {
  try {
    const liga = await Liga.findOne({ where: { userId: req.user.id } });
    if (!liga) {
      return res.status(404).json({ msg: 'Liga profile not found' });
    }
    await liga.update({
      name: req.body.name || liga.name,
      logo: req.body.logo || liga.logo,
      country: req.body.country || liga.country,
      level: req.body.level || liga.level,
      foundedYear: req.body.foundedYear || liga.foundedYear,
      description: req.body.description || liga.description,
      website: req.body.website || liga.website,
      clubs: req.body.clubs || liga.clubs,
      competitions: req.body.competitions || liga.competitions,
      contact: req.body.contact || liga.contact,
      socialLinks: req.body.socialLinks || liga.socialLinks,
    });
    res.json(liga);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// List all Liga profiles
exports.getAllLigas = async (req, res) => {
  try {
    const ligas = await Liga.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(ligas);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
