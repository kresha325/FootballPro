const Coach = require('../models/Profile');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ClubStaff = require('../models/ClubStaff');
const { Op } = require('sequelize');

const resolveClubUser = async ({ clubId, clubName }) => {
  let clubUser;

  if (clubId && !isNaN(Number(clubId))) {
    const clubById = await User.findByPk(parseInt(clubId));
    if (clubById && ['club', 'klub'].includes(clubById.role)) {
      clubUser = clubById;
    }
  }

  if (!clubUser && clubName) {
    const clubByUser = await User.findOne({
      where: {
        role: { [Op.in]: ['club', 'klub'] },
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${clubName}%` } },
          { lastName: { [Op.iLike]: `%${clubName}%` } },
          { email: { [Op.iLike]: `%${clubName}%` } },
        ],
      },
    });

    if (clubByUser) {
      clubUser = clubByUser;
    } else {
      const clubProfile = await Profile.findOne({
        where: {
          club: {
            [Op.iLike]: `%${clubName}%`,
          },
        },
        include: [{
          model: User,
          where: { role: { [Op.in]: ['club', 'klub'] } },
        }],
      });

      if (clubProfile) {
        clubUser = clubProfile.User;
      }
    }
  }

  return clubUser;
};

// Create Coach profile
exports.createCoach = async (req, res) => {
  try {
    if (!['coach', 'trajner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const existingProfile = await Coach.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Coach profile already exists' });
    }
    let clubId = req.body.clubId;
    const clubUser = await resolveClubUser({ clubId, clubName: req.body.club });
    if (clubUser) {
      clubId = clubUser.id;
    }

    const profile = await Coach.create({
      userId: req.user.id,
      bio: req.body.bio,
      city: req.body.city,
      country: req.body.country,
      club: req.body.club,
      clubId: clubId || null,
      coachAffiliation: req.body.coachAffiliation,
      coachCategory: req.body.coachCategory,
      careerHistory: req.body.careerHistory,
      contact: req.body.contact,
      coverPhoto: req.body.coverPhoto,
      profilePhoto: req.body.profilePhoto,
    });

    const staffClubUser = clubUser || (await resolveClubUser({ clubId: req.body.clubId, clubName: req.body.club }));
    if (staffClubUser) {
      const existing = await ClubStaff.findOne({
        where: {
          clubId: staffClubUser.id,
          staffId: req.user.id,
        },
      });

      const category = req.body.coachCategory;
      const staffRoleMap = {
        general_trainer: 'head_coach',
        assistant_trainer: 'assistant_coach',
        fitness_trainer: 'fitness_coach',
        goalkeeper_trainer: 'goalkeeper_coach',
        technical_trainer: 'technical_coach',
        tactical_trainer: 'tactical_coach',
        psychological_trainer: 'sports_psychologist',
        youth_trainer: 'assistant_coach',
        rehabilitation_trainer: 'physiotherapist',
      };

      if (existing) {
        if (existing.status !== 'active') {
          existing.status = 'pending';
          existing.staffRole = staffRoleMap[category] || existing.staffRole || 'assistant_coach';
          existing.teamType = existing.teamType || 'first_team';
          await existing.save();
          console.log('[ClubStaff] Updated existing staff to pending:', existing.toJSON());
        }
      } else {
        const created = await ClubStaff.create({
          clubId: staffClubUser.id,
          staffId: req.user.id,
          staffRole: staffRoleMap[category] || 'assistant_coach',
          teamType: 'first_team',
          status: 'pending',
        });
        console.log('[ClubStaff] Created new pending staff:', created.toJSON());
      }
    }
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
    let clubId = req.body.clubId || profile.clubId;
    const clubUser = await resolveClubUser({ clubId, clubName: req.body.club || profile.club });
    if (clubUser) {
      clubId = clubUser.id;
    }

    await profile.update({
      bio: req.body.bio || profile.bio,
      city: req.body.city || profile.city,
      country: req.body.country || profile.country,
      club: req.body.club || profile.club,
      clubId: clubId || null,
      coachAffiliation: req.body.coachAffiliation || profile.coachAffiliation,
      coachCategory: req.body.coachCategory || profile.coachCategory,
      careerHistory: req.body.careerHistory || profile.careerHistory,
      contact: req.body.contact || profile.contact,
      coverPhoto: req.body.coverPhoto || profile.coverPhoto,
      profilePhoto: req.body.profilePhoto || profile.profilePhoto,
    });

    const clubName = req.body.club || profile.club;
    const staffClubUser = clubUser || (await resolveClubUser({ clubId: req.body.clubId, clubName }));

    if (staffClubUser) {
      const existing = await ClubStaff.findOne({
        where: {
          clubId: staffClubUser.id,
          staffId: req.user.id,
        },
      });

      const normalizeCoachCategory = (value) => {
        const raw = String(value || '').toLowerCase();
        const map = {
          general_trainer: 'general_trainer',
          assistant_trainer: 'assistant_trainer',
          fitness_trainer: 'fitness_trainer',
          goalkeeper_trainer: 'goalkeeper_trainer',
          technical_trainer: 'technical_trainer',
          tactical_trainer: 'tactical_trainer',
          psychological_trainer: 'psychological_trainer',
          youth_trainer: 'youth_trainer',
          rehabilitation_trainer: 'rehabilitation_trainer',
          trajner_i_pergjithshem: 'general_trainer',
          trajner_i_përgjithshëm: 'general_trainer',
          trajner_ndihmes: 'assistant_trainer',
          trajner_ndihmës: 'assistant_trainer',
          trajner_fizik: 'fitness_trainer',
          trajner_i_portiereve: 'goalkeeper_trainer',
          trajner_i_portierëve: 'goalkeeper_trainer',
          trajner_teknik: 'technical_trainer',
          trajner_taktik: 'tactical_trainer',
          trajner_psikologjik: 'psychological_trainer',
          trajner_i_te_rinjve: 'youth_trainer',
          trajner_i_të_rinjve: 'youth_trainer',
          trajner_rehabilitimi: 'rehabilitation_trainer',
        };
        return map[raw] || value;
      };
      const category = normalizeCoachCategory(req.body.coachCategory || profile.coachCategory);
      const staffRoleMap = {
        general_trainer: 'head_coach',
        assistant_trainer: 'assistant_coach',
        fitness_trainer: 'fitness_coach',
        goalkeeper_trainer: 'goalkeeper_coach',
        technical_trainer: 'technical_coach',
        tactical_trainer: 'tactical_coach',
        psychological_trainer: 'sports_psychologist',
        youth_trainer: 'assistant_coach',
        rehabilitation_trainer: 'physiotherapist',
      };

      if (existing) {
        if (existing.status !== 'active') {
          existing.status = 'pending';
        }
        existing.staffRole = staffRoleMap[category] || existing.staffRole || 'assistant_coach';
        existing.teamType = existing.teamType || 'first_team';
        await existing.save();
        console.log('[ClubStaff] Updated existing staff to pending:', existing.toJSON());
      } else {
        const created = await ClubStaff.create({
          clubId: staffClubUser.id,
          staffId: req.user.id,
          staffRole: staffRoleMap[category] || 'assistant_coach',
          teamType: 'first_team',
          status: 'pending',
        });
        console.log('[ClubStaff] Created new pending staff:', created.toJSON());
      }
    }
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
