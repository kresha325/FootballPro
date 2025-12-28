const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ClubStaff = require('../models/ClubStaff');
const User = require('../models/User');
const Profile = require('../models/Profile');

// Get club staff
router.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const { status, teamType } = req.query;

    const where = { clubId: parseInt(clubId) };
    if (status) where.status = status;
    if (teamType) where.teamType = teamType;

    const staff = await ClubStaff.findAll({
      where,
      include: [{
        model: User,
        as: 'staff',
        attributes: ['id', 'firstName', 'lastName', 'role', 'gender'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'coachAffiliation', 'coachCategory', 'bio'] }]
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json(staff);
  } catch (error) {
    console.error('Get club staff error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get staff member's club assignments
router.get('/staff/:staffId', protect, async (req, res) => {
  try {
    const { staffId } = req.params;

    const assignments = await ClubStaff.findAll({
      where: { staffId: parseInt(staffId) },
      include: [{
        model: User,
        as: 'club',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['club', 'profilePhoto'] }]
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get staff assignments error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add staff member (club owners only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'club') {
      return res.status(403).json({ msg: 'Only clubs can add staff' });
    }

    const { staffId, staffRole, teamType, contractUntil } = req.body;

    // Check if already exists
    const existing = await ClubStaff.findOne({
      where: {
        clubId: req.user.id,
        staffId: parseInt(staffId),
        status: 'active'
      }
    });

    if (existing) {
      return res.status(400).json({ msg: 'Staff member already assigned' });
    }

    const staffMember = await ClubStaff.create({
      clubId: req.user.id,
      staffId: parseInt(staffId),
      staffRole,
      teamType: teamType || 'first_team',
      contractUntil,
      status: 'pending',
    });

    const result = await ClubStaff.findByPk(staffMember.id, {
      include: [{
        model: User,
        as: 'staff',
        attributes: ['id', 'firstName', 'lastName', 'role', 'gender'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'coachAffiliation', 'coachCategory'] }]
      }]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update staff status/details (club owners only)
router.patch('/:staffMemberId', protect, async (req, res) => {
  try {
    const { staffMemberId } = req.params;
    const staffMember = await ClubStaff.findByPk(staffMemberId);

    if (!staffMember) {
      return res.status(404).json({ msg: 'Staff member not found' });
    }

    if (staffMember.clubId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { status, staffRole, teamType, contractUntil } = req.body;
    
    if (status) staffMember.status = status;
    if (staffRole) staffMember.staffRole = staffRole;
    if (teamType) staffMember.teamType = teamType;
    if (contractUntil) staffMember.contractUntil = contractUntil;
    
    if (status === 'active' && !staffMember.joinedAt) {
      staffMember.joinedAt = new Date();
    }
    if (status === 'inactive' && !staffMember.leftAt) {
      staffMember.leftAt = new Date();
    }

    await staffMember.save();

    const result = await ClubStaff.findByPk(staffMemberId, {
      include: [{
        model: User,
        as: 'staff',
        attributes: ['id', 'firstName', 'lastName', 'role', 'gender'],
        include: [{ model: Profile, attributes: ['profilePhoto', 'coachAffiliation', 'coachCategory'] }]
      }]
    });

    res.json(result);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Remove staff member (club owners only)
router.delete('/:staffMemberId', protect, async (req, res) => {
  try {
    const { staffMemberId } = req.params;
    const staffMember = await ClubStaff.findByPk(staffMemberId);

    if (!staffMember) {
      return res.status(404).json({ msg: 'Staff member not found' });
    }

    if (staffMember.clubId !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await staffMember.destroy();
    res.json({ msg: 'Staff member removed' });
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
