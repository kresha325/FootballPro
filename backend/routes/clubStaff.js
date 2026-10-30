const { toAbsoluteUploadsUrl } = require('../utils/url');
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const ClubStaff = require('../models/ClubStaff');
const User = require('../models/User');
const Profile = require('../models/Profile');

function withAbsoluteStaffPhotos(req, rows) {
  return (rows || []).map((row) => {
    const j = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    if (j.staff?.Profile?.profilePhoto) {
      j.staff.Profile.profilePhoto = toAbsoluteUploadsUrl(req, j.staff.Profile.profilePhoto);
    }
    return j;
  });
}

// Get club staff
router.get('/club/:clubId', optionalAuth, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { status, teamType } = req.query;
    const numericClubId = Number(clubId);
    if (!Number.isInteger(numericClubId) || numericClubId < 1) return res.status(400).json({ msg: 'Invalid clubId' });

    const requestedStatus = status ? String(status).trim().toLowerCase() : null;
    if (requestedStatus && !['pending', 'active', 'inactive'].includes(requestedStatus)) {
      return res.status(400).json({ msg: 'Invalid staff status' });
    }

    const viewerRole = String(req.user?.role || '').toLowerCase();
    let canManageStaff = viewerRole === 'admin';
    if (!canManageStaff && req.user && Number(req.user.id) === numericClubId && viewerRole === 'club') {
      const club = await User.findByPk(numericClubId, {
        attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'],
      });
      canManageStaff = Boolean(
        club && String(club.role || '').toLowerCase() === 'club' && club.adminVerified === true && !club.bannedAt && !club.deletedAt
      );
    }

    if (requestedStatus && requestedStatus !== 'active' && !canManageStaff) {
      return res.status(403).json({ msg: 'Only the verified club or platform admin can view non-public staff assignments.' });
    }

    const publicActiveView = !canManageStaff;
    const where = { clubId: numericClubId, status: requestedStatus || 'active' };
    if (publicActiveView || where.status === 'active') where.leftAt = null;
    if (teamType) where.teamType = teamType;

    let staff;
    try {
      staff = await ClubStaff.findAll({
        where,
        include: [{
          model: User,
          as: 'staff',
          attributes: ['id', 'firstName', 'lastName', 'role', 'gender', 'bannedAt', 'deletedAt'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'bio'] }]
        }],
        order: [['createdAt', 'DESC']],
      });
    } catch (includeError) {
      console.warn('Get club staff include error, falling back:', includeError.message);
      try {
        staff = await ClubStaff.findAll({
          where,
          include: [{
            model: User,
            as: 'staff',
            attributes: ['id', 'firstName', 'lastName', 'role', 'gender', 'bannedAt', 'deletedAt'],
          }],
          order: [['createdAt', 'DESC']],
        });
      } catch (fallbackError) {
        console.warn('Get club staff fallback include error:', fallbackError.message);
        staff = await ClubStaff.findAll({ where, order: [['createdAt', 'DESC']] });
      }
    }

    const visibleStaff = publicActiveView
      ? staff.filter((assignment) => {
        if (assignment.leftAt || String(assignment.status || '').toLowerCase() !== 'active') return false;
        const staffAccount = assignment.staff || assignment.User;
        if (!staffAccount || staffAccount.bannedAt || staffAccount.deletedAt) return false;
        const expiryText = String(assignment.contractUntil || '').trim();
        if (!expiryText || expiryText.toLowerCase() === 'vazhdon') return true;
        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiryText);
        const expiry = new Date(dateOnly ? `${expiryText}T23:59:59.999Z` : expiryText);
        return Number.isFinite(expiry.getTime()) && expiry >= new Date();
      })
      : staff;
    res.json(withAbsoluteStaffPhotos(req, visibleStaff));
  } catch (error) {
    console.error('Get club staff error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get staff member's club assignments
router.get('/staff/:staffId', protect, async (req, res) => {
  try {
    const { staffId } = req.params;
    if (Number(staffId) !== Number(req.user.id) && String(req.user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ msg: 'Nuk je i autorizuar të shohësh caktimet e një anëtari tjetër të stafit.' });
    }

    let assignments;
    try {
      assignments = await ClubStaff.findAll({
        where: { staffId: parseInt(staffId) },
        include: [{
          model: User,
          as: 'club',
          attributes: ['id', 'firstName', 'lastName', 'adminVerified', 'bannedAt', 'deletedAt'],
          include: [{ model: Profile, as: 'Profile', attributes: ['club', 'profilePhoto'] }]
        }],
        order: [['createdAt', 'DESC']],
      });
    } catch (includeError) {
      console.warn('Get staff assignments include error, falling back:', includeError.message);
      try {
        assignments = await ClubStaff.findAll({
          where: { staffId: parseInt(staffId) },
          include: [{
            model: User,
            as: 'club',
          attributes: ['id', 'firstName', 'lastName', 'adminVerified', 'bannedAt', 'deletedAt'],
          }],
          order: [['createdAt', 'DESC']],
        });
      } catch (fallbackError) {
        console.warn('Get staff assignments fallback include error:', fallbackError.message);
        assignments = await ClubStaff.findAll({ where: { staffId: parseInt(staffId) }, order: [['createdAt', 'DESC']] });
      }
    }

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
        include: [{ model: Profile, attributes: ['profilePhoto', 'bio'] }]
      }]
    });

    res.status(201).json(withAbsoluteStaffPhotos(req, result ? [result] : [])[0] || result);
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
        include: [{ model: Profile, attributes: ['profilePhoto', 'bio'] }]
      }]
    });

    res.json(withAbsoluteStaffPhotos(req, result ? [result] : [])[0] || result);
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
