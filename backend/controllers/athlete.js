const Athlete = require('../models/Profile');
const User = require('../models/User');
const Follow = require('../models/Follow');
const GuardianConsent = require('../models/GuardianConsent');
const { Op } = require('sequelize');
const { applyProfilePrivacy, isProfessionalRole } = require('../utils/profilePrivacy');
const { needsParentVerification } = require('../utils/userVerification');
const { hasGuardianAuthorization } = require('../utils/parentalAuthorization');

function profilePlain(profile) {
  return profile?.get ? profile.get({ plain: true }) : profile;
}

function isMinorAthlete(user) {
  return String(user?.role || '').toLowerCase() === 'athlete' && needsParentVerification(user);
}

/** Serialize the legacy athlete API with the same visibility rules as profile APIs. */
function serializeLegacyAthleteProfile(profile, viewer, { isFollower = false } = {}) {
  const plain = profilePlain(profile);
  const targetUser = plain?.User || profile?.User;
  if (!plain || !targetUser || String(targetUser.role || '').toLowerCase() !== 'athlete') return null;
  if (targetUser.deletedAt || targetUser.bannedAt) return null;

  const isOwner = Number(viewer?.id) === Number(targetUser.id);
  const response = { ...plain };
  delete response.User;

  // The legacy response has only ever exposed these identity fields. Keep that
  // contract; never include account email, DOB, parent data, or tokens here.
  response.User = {
    id: targetUser.id,
    role: targetUser.role,
    firstName: targetUser.firstName,
    lastName: targetUser.lastName,
  };
  response.age = targetUser.getAge?.() ?? null;
  response.ageGroup = targetUser.getAgeGroup?.() ?? null;
  delete response.dateOfBirth;

  applyProfilePrivacy(response, {
    isOwner,
    isFollower: Boolean(isFollower),
    isProfessional: isProfessionalRole(viewer?.role),
  }, response.privacy);
  if (!isOwner) delete response.dateOfBirth;
  return response;
}

async function activeGuardianIds(users) {
  const minorIds = users.filter(isMinorAthlete).map((user) => Number(user.id));
  if (!minorIds.length) return new Set();
  const consents = await GuardianConsent.findAll({
    where: { minorUserId: { [Op.in]: minorIds }, verifiedAt: { [Op.ne]: null }, revokedAt: null },
    attributes: ['minorUserId'],
  });
  return new Set(consents.map((consent) => Number(consent.minorUserId)));
}

async function followerIdsFor(viewerId, targetIds) {
  if (!viewerId || !targetIds.length) return new Set();
  const follows = await Follow.findAll({
    where: { followerId: viewerId, followingId: { [Op.in]: targetIds } },
    attributes: ['followingId'],
  });
  return new Set(follows.map((follow) => Number(follow.followingId)));
}

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
    const userId = Number(req.params.id || req.user.id);
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ msg: 'ID e pavlefshme' });
    const profile = await Athlete.findOne({
      where: { userId },
      include: [{ model: User, attributes: [
        'id', 'role', 'firstName', 'lastName', 'dateOfBirth', 'parentVerified', 'deletedAt', 'bannedAt',
      ] }],
    });
    if (!profile) {
      return res.status(404).json({ msg: 'Athlete profile not found' });
    }
    const plain = profilePlain(profile);
    const targetUser = plain?.User || profile.User;
    if (!targetUser || String(targetUser.role || '').toLowerCase() !== 'athlete') {
      return res.status(404).json({ msg: 'Athlete profile not found' });
    }
    const viewer = req.user || {};
    const guardianConsentActive = isMinorAthlete(targetUser)
      ? Boolean(await GuardianConsent.findOne({
        where: { minorUserId: targetUser.id, verifiedAt: { [Op.ne]: null }, revokedAt: null },
        attributes: ['id'],
      }))
      : true;
    if (!hasGuardianAuthorization(targetUser, guardianConsentActive) && viewer.role !== 'admin') {
      return res.status(404).json({ msg: 'Athlete profile not found' });
    }
    const isFollower = !isOwnerRequest(viewer, targetUser) && Boolean(await Follow.findOne({
      where: { followerId: viewer.id, followingId: targetUser.id },
      attributes: ['id'],
    }));
    const response = serializeLegacyAthleteProfile(profile, viewer, { isFollower });
    if (!response) return res.status(404).json({ msg: 'Athlete profile not found' });
    return res.json(response);
  } catch {
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
      include: [{ model: User, attributes: [
        'id', 'role', 'firstName', 'lastName', 'dateOfBirth', 'parentVerified', 'deletedAt', 'bannedAt',
      ], where: { role: 'athlete' } }],
      order: [['createdAt', 'DESC']]
    });
    const plainRows = athletes.map(profilePlain);
    const users = plainRows.map((profile) => profile?.User).filter(Boolean);
    const [consentedMinorIds, followerIds] = await Promise.all([
      activeGuardianIds(users),
      followerIdsFor(req.user?.id, users.map((user) => Number(user.id))),
    ]);
    const visible = plainRows.flatMap((profile) => {
      const user = profile?.User;
      if (!user || (user.role !== 'athlete' && user.role !== 'ATHLETE')) return [];
      if (!hasGuardianAuthorization(user, consentedMinorIds.has(Number(user.id))) && req.user?.role !== 'admin') return [];
      const response = serializeLegacyAthleteProfile(profile, req.user, {
        isFollower: followerIds.has(Number(user.id)),
      });
      return response ? [response] : [];
    });
    return res.json(visible);
  } catch {
    res.status(500).json({ msg: 'Server error' });
  }
};

function isOwnerRequest(viewer, targetUser) {
  return Number(viewer?.id) === Number(targetUser?.id);
}

exports.serializeLegacyAthleteProfile = serializeLegacyAthleteProfile;
