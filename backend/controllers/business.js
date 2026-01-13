const Business = require('../models/Profile');
const User = require('../models/User');

// Create Business profile
exports.createBusiness = async (req, res) => {
  try {
    if (req.user.role !== 'business') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingProfile = await Business.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Business profile already exists' });
    }
    const profile = await Business.create({
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

// Get Business profile by userId
exports.getBusiness = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await Business.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!profile) {
      return res.status(404).json({ msg: 'Business profile not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Business profile
exports.updateBusiness = async (req, res) => {
  try {
    const profile = await Business.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ msg: 'Business profile not found' });
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

// List all Business profiles
exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
