const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ClubMember = require('../models/ClubMember');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');

// Get club members (for club profile)
router.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const { status } = req.query; // pending, approved, rejected

    const where = { clubId: parseInt(clubId) };
    if (status) {
      where.status = status;
    }

    const members = await ClubMember.findAll({
      where,
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email', 'gender'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto', 'position', 'bio', 'stats', 'age', 'ageGroup'],
          }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(members);
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
    const { clubName, position, jerseyNumber } = req.body;

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
      // If no exact club profile found, create pending request anyway
      // This allows clubs to be notified even if they haven't set up their profile yet
      return res.status(404).json({ msg: 'Club not found in system. Make sure the club has registered.' });
    }

    const clubUser = clubProfile.User;

    // Check if already exists
    const existing = await ClubMember.findOne({
      where: {
        clubId: clubUser.id,
        athleteId: req.user.id,
      },
    });

    if (existing) {
      return res.status(400).json({ msg: 'Membership request already exists' });
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
    }
    await membership.save();

    const updatedMembership = await ClubMember.findByPk(membershipId, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'gender'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'age', 'ageGroup'] }],
        },
      ],
    });

    res.json(updatedMembership);
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
          attributes: ['id', 'firstName', 'lastName', 'gender'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'age', 'ageGroup'] }],
        },
      ],
    });

    res.json(updatedMembership);
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

module.exports = router;
