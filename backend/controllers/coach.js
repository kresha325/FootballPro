const Coach = require('../models/Profile');
const User = require('../models/User');

// Create Coach profile
exports.createCoach = async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingProfile = await Coach.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Coach profile already exists' });
    }
    const profile = await Coach.create({
      userId: req.user.id,
      bio: req.body.bio,
      city: req.body.city,
      country: req.body.country,
      club: req.body.club,
      coachAffiliation: req.body.coachAffiliation,
      coachCategory: req.body.coachCategory,
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

// Get Coach profile by userId
exports.getCoach = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await Coach.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!profile) {
      return res.status(404).json({ msg: 'Coach profile not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Coach profile
exports.updateCoach = async (req, res) => {
  try {
    const profile = await Coach.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ msg: 'Coach profile not found' });
    }
    await profile.update({
      bio: req.body.bio || profile.bio,
      city: req.body.city || profile.city,
      country: req.body.country || profile.country,
      club: req.body.club || profile.club,
      coachAffiliation: req.body.coachAffiliation || profile.coachAffiliation,
      coachCategory: req.body.coachCategory || profile.coachCategory,
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

// List all Coach profiles
exports.getAllCoaches = async (req, res) => {
  try {
    const coaches = await Coach.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(coaches);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
