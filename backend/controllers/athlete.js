const Athlete = require('../models/Profile');
const User = require('../models/User');

// Create Athlete profile
exports.createAthlete = async (req, res) => {
  try {
    if (req.user.role !== 'athlete') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingProfile = await Athlete.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Athlete profile already exists' });
    }
    const profile = await Athlete.create({
      userId: req.user.id,
      bio: req.body.bio,
      city: req.body.city,
      country: req.body.country,
      club: req.body.club,
      position: req.body.position,
      stats: req.body.stats,
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

// Get Athlete profile by userId
exports.getAthlete = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await Athlete.findOne({
      where: { userId },
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
    });
    if (!profile) {
      return res.status(404).json({ msg: 'Athlete profile not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update Athlete profile
exports.updateAthlete = async (req, res) => {
  try {
    const profile = await Athlete.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ msg: 'Athlete profile not found' });
    }
    await profile.update({
      bio: req.body.bio || profile.bio,
      city: req.body.city || profile.city,
      country: req.body.country || profile.country,
      club: req.body.club || profile.club,
      position: req.body.position || profile.position,
      stats: req.body.stats || profile.stats,
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

// List all Athlete profiles
exports.getAllAthletes = async (req, res) => {
  try {
    const athletes = await Athlete.findAll({
      include: [{ model: User, attributes: ['id', 'role', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(athletes);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
