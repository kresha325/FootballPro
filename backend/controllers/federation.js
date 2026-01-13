const Federation = require('../models/Profile');
const User = require('../models/User');

// Create Federation profile
exports.createFederation = async (req, res) => {
  try {
    if (req.user.role !== 'federation') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingProfile = await Federation.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Federation profile already exists' });
    }
    const profile = await Federation.create({
      userId: req.user.id,
      bio: req.body.bio,
      city: req.body.city,
      country: req.body.country,
      club: req.body.club,
      careerHistory: req.body.careerHistory,
      contact: req.body.contact,
      coverPhoto: req.body.coverPhoto,
      profilePhoto: req.body.profilePhoto,
    });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get Federation profile by userId
exports.getFederation = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await Federation.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!profile) {
      return res.status(404).json({ msg: 'Federation profile not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Federation profile
exports.updateFederation = async (req, res) => {
  try {
    const profile = await Federation.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ msg: 'Federation profile not found' });
    }
    await profile.update({
      bio: req.body.bio || profile.bio,
      city: req.body.city || profile.city,
      country: req.body.country || profile.country,
      club: req.body.club || profile.club,
      careerHistory: req.body.careerHistory || profile.careerHistory,
      contact: req.body.contact || profile.contact,
      coverPhoto: req.body.coverPhoto || profile.coverPhoto,
      profilePhoto: req.body.profilePhoto || profile.profilePhoto,
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// List all Federation profiles
exports.getAllFederations = async (req, res) => {
  try {
    const federations = await Federation.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(federations);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
