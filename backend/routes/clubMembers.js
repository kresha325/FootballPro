const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ClubMember = require('../models/ClubMember');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');

const hydrateAgeGroup = async (membership) => {
  if (!membership || !membership.athlete || !membership.athlete.Profile) {
    return membership.toJSON ? membership.toJSON() : membership;
  }

  const athlete = membership.athlete;
  const profile = athlete.Profile;
  let age = profile.age;
  let ageGroup = profile.ageGroup;
  const computedAge = athlete.getAge ? athlete.getAge() : null;
  const computedAgeGroup = athlete.getAgeGroup ? athlete.getAgeGroup() : null;

  let changed = false;
  if ((age === null || age === undefined) && computedAge !== null) {
    age = computedAge;
    profile.age = computedAge;
    changed = true;
  }
  if ((!ageGroup || ageGroup === 'N/A') && computedAgeGroup) {
    ageGroup = computedAgeGroup;
    profile.ageGroup = computedAgeGroup;
    changed = true;
  }

  if (changed && profile.save && profile.id) {
    await profile.save();
  }

  const plain = membership.toJSON ? membership.toJSON() : membership;
  if (plain?.athlete?.Profile) {
    plain.athlete.Profile.age = age ?? plain.athlete.Profile.age;
    plain.athlete.Profile.ageGroup = ageGroup ?? plain.athlete.Profile.ageGroup;
  }

  return plain;
};

// Get club members (for club profile)
router.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const { status } = req.query; // pending, approved, rejected

    const where = { clubId: parseInt(clubId) };
    if (status) {
      where.status = status;
    }

    if (!status) {
      try {
        const clubProfile = await Profile.findOne({ where: { userId: parseInt(clubId) } });
        if (clubProfile?.club || clubProfile?.userId) {
          const orFilters = [];
          if (clubProfile?.club) {
            orFilters.push({
              club: {
                [Op.iLike]: `%${clubProfile.club}%`,
              },
            });
          }
          orFilters.push({ clubId: parseInt(clubId) });

          const athleteProfiles = await Profile.findAll({
            where: {
              [Op.or]: orFilters,
            },
            include: [{
              model: User,
              attributes: ['id', 'role'],
              where: { role: 'athlete' },
            }],
          });

          await Promise.all(
            athleteProfiles.map(async (profile) => {
              const existing = await ClubMember.findOne({
                where: {
                  clubId: parseInt(clubId),
                  athleteId: profile.userId,
                },
              });

              if (!existing) {
                await ClubMember.create({
                  clubId: parseInt(clubId),
                  athleteId: profile.userId,
                  status: 'pending',
                  position: profile.position || null,
                  jerseyNumber: profile.stats?.jerseyNumber || null,
                });
              }
            })
          );
        }
      } catch (syncError) {
        console.error('Club members sync error:', syncError);
      }
    }

    const members = await ClubMember.findAll({
      where,
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email', 'gender', 'dateOfBirth'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto', 'position', 'bio', 'stats', 'age', 'ageGroup'],
          }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const serialized = await Promise.all(members.map(hydrateAgeGroup));
    res.json(serialized);
  } catch (error) {
    console.error('Get club members error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get athlete's club memberships
router.get('/athlete/:athleteId', protect, async (req, res) => {
  try {
    const { athleteId } = req.params;

    const memberships = await ClubMember.findAll({
      where: { athleteId: parseInt(athleteId) },
      include: [
        {
          model: User,
          as: 'club',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['club', 'profilePhoto'],
          }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(memberships);
  } catch (error) {
    console.error('Get athlete memberships error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Request to join club (automatically when athlete selects club)
router.post('/request', protect, async (req, res) => {
  try {
    const { clubId, clubName, position, jerseyNumber } = req.body;

    let clubUser;

    if (clubId && !isNaN(Number(clubId))) {
      const club = await User.findByPk(parseInt(clubId));
      if (!club || club.role !== 'club') {
        return res.status(404).json({ msg: 'Club not found in system. Make sure the club has registered.' });
      }
      clubUser = club;
    }

    if (!clubUser) {
      // Try to find club user by name
      const clubByUser = await User.findOne({
        where: {
          role: 'club',
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
        // Find club user by club name in Profile
        const clubProfile = await Profile.findOne({
          where: {
            club: {
              [Op.iLike]: `%${clubName}%`,
            },
          },
          include: [{
            model: User,
            where: { role: 'club' },
          }],
        });

        if (!clubProfile) {
          return res.status(404).json({ msg: 'Club not found in system. Make sure the club has registered.' });
        }

        clubUser = clubProfile.User;
      }
    }

    // Check if already exists
    const existing = await ClubMember.findOne({
      where: {
        clubId: clubUser.id,
        athleteId: req.user.id,
      },
    });

    if (existing) {
      if (existing.status === 'rejected') {
        existing.status = 'pending';
        if (position) existing.position = position;
        if (jerseyNumber !== undefined) existing.jerseyNumber = jerseyNumber;
        await existing.save();
      }

      const existingWithDetails = await ClubMember.findByPk(existing.id, {
        include: [
          {
            model: User,
            as: 'athlete',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{ model: Profile, attributes: ['profilePhoto', 'position'] }],
          },
        ],
      });

      return res.json(existingWithDetails);
    }

    // Create membership request
    const membership = await ClubMember.create({
      clubId: clubUser.id,
      athleteId: req.user.id,
      status: 'pending',
      position,
      jerseyNumber,
    });

    const membershipWithDetails = await ClubMember.findByPk(membership.id, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position'] }],
        },
      ],
    });

    res.json(membershipWithDetails);
  } catch (error) {
    console.error('Request membership error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Approve/Reject membership (club owners only)
router.put('/:membershipId/status', protect, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    const membership = await ClubMember.findByPk(membershipId);
    if (!membership) {
      return res.status(404).json({ msg: 'Membership not found' });
    }

    // Verify user is the club owner
    if (membership.clubId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    membership.status = status;
    if (status === 'approved') {
      membership.joinedAt = new Date();
      const clubProfile = await Profile.findOne({ where: { userId: membership.clubId } });
      const athleteProfile = await Profile.findOne({ where: { userId: membership.athleteId } });
      if (athleteProfile && clubProfile) {
        athleteProfile.club = clubProfile.club || athleteProfile.club;
        athleteProfile.clubLogo = clubProfile.profilePhoto || athleteProfile.clubLogo;
        await athleteProfile.save();
      }
    }
    await membership.save();

    const updatedMembership = await ClubMember.findByPk(membershipId, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'age', 'ageGroup'] }],
        },
      ],
    });

    const hydrated = await hydrateAgeGroup(updatedMembership);
    res.json(hydrated);
  } catch (error) {
    console.error('Update membership status error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update member details like teamType (club owners only)
router.patch('/:membershipId', protect, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { teamType, position, jerseyNumber } = req.body;

    const membership = await ClubMember.findByPk(membershipId);
    if (!membership) {
      return res.status(404).json({ msg: 'Membership not found' });
    }

    // Verify user is the club owner
    if (membership.clubId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (teamType) membership.teamType = teamType;
    if (position) membership.position = position;
    if (jerseyNumber !== undefined) membership.jerseyNumber = jerseyNumber;
    
    await membership.save();

    const updatedMembership = await ClubMember.findByPk(membershipId, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'age', 'ageGroup'] }],
        },
      ],
    });

    const hydrated = await hydrateAgeGroup(updatedMembership);
    res.json(hydrated);
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Remove member from club (club owners only)
router.delete('/:membershipId', protect, async (req, res) => {
  try {
    const { membershipId } = req.params;

    const membership = await ClubMember.findByPk(membershipId);
    if (!membership) {
      return res.status(404).json({ msg: 'Membership not found' });
    }

    // Verify user is the club owner
    if (membership.clubId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await membership.destroy();
    res.json({ msg: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Endpoint debug për të marrë anëtarët pending
router.get('/debug/pending-members', async (req, res) => {
  try {
    const pending = await ClubMember.findAll({ where: { status: 'pending' } });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
