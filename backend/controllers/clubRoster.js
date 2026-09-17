const ClubRosterRequest = require('../models/ClubRosterRequest');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { createNotification } = require('./notifications');
const { sendEmail } = require('../services/emailService');
const { PROFILE_ROSTER_ATTRIBUTES } = require('../utils/profileFields');

// Submit roster request (athlete → club)
exports.submitRosterRequest = async (req, res) => {
  try {
    const athleteId = req.user.id;
    const { clubId, position, jerseyNumber, message } = req.body;

    // Validate club exists and is a club account
    const club = await User.findByPk(clubId);
    if (!club || club.role !== 'club') {
      return res.status(400).json({ error: 'ID e klubit është e pavlefshme' });
    }

    // Check for existing pending request
    const existing = await ClubRosterRequest.findOne({
      where: {
        athleteId,
        clubId,
        status: 'pending'
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ju tashmë keni një kërkesë në pritje për këtë klub' });
    }

    // Create request
    const request = await ClubRosterRequest.create({
      athleteId,
      clubId,
      position,
      jerseyNumber,
      message,
      status: 'pending',
    });

    // Notify club (in-app + push)
    const athlete = await User.findByPk(athleteId);
    const pos = position ? ` as ${position}` : '';
    await createNotification({
      userId: clubId,
      actorId: athleteId,
      type: 'system',
      title: 'Kërkesë anëtarësimi',
      message: `${athlete.firstName} ${athlete.lastName} dëshiron të bashkohet me klubin${pos}`,
      link: '/club-roster?tab=pending',
      entityType: 'club_roster_request',
      entityId: request.id,
      metadata: { kind: 'club_membership_request' },
    });

    // Send email to club
    await sendEmail(
      club.email,
      'rosterRequest',
      {
        athleteName: `${athlete.firstName} ${athlete.lastName}`,
        position,
        message: message || 'No message',
        clubName: club.firstName
      }
    );

    res.status(201).json({
      msg: 'Roster request submitted successfully',
      request
    });
  } catch (error) {
    console.error('Submit roster request error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get pending roster requests (for club)
exports.getPendingRequests = async (req, res) => {
  try {
    const clubId = req.user.id;

    if (req.user.role !== 'club') {
      return res.status(403).json({ error: 'Vetëm klubet mund t’i shohin kërkesat e formacionit' });
    }

    const requests = await ClubRosterRequest.findAll({
      where: {
        clubId,
        status: 'pending'
      },
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Profile,
            attributes: PROFILE_ROSTER_ATTRIBUTES
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all roster requests (with filters)
exports.getAllRequests = async (req, res) => {
  try {
    const { status, clubId, athleteId } = req.query;
    const where = {};

    if (status) where.status = status;
    if (clubId) where.clubId = clubId;
    if (athleteId) where.athleteId = athleteId;

    // If user is athlete, only show their requests
    if (req.user.role === 'athlete') {
      where.athleteId = req.user.id;
    }

    // If user is club, only show requests to them
    if (req.user.role === 'club') {
      where.clubId = req.user.id;
    }

    const requests = await ClubRosterRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'stats'] }]
        },
        {
          model: User,
          as: 'club',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'club'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(requests);
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Approve roster request
exports.approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseMessage } = req.body;
    const clubId = req.user.id;

    const request = await ClubRosterRequest.findByPk(requestId, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'club',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ error: 'Kërkesa nuk u gjet' });
    }

    if (request.clubId !== clubId) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Kërkesa është përpunuar tashmë' });
    }

    // Update request
    request.status = 'approved';
    request.approvedBy = clubId;
    request.approvedAt = new Date();
    request.responseMessage = responseMessage;
    await request.save();

    // Notify athlete
    await createNotification({
      userId: request.athleteId,
      actorId: clubId,
      type: 'system',
      title: 'Kërkesa u aprovua',
      message: `${request.club.firstName} ka aprovuar kërkesën tuaj si ${request.position}`,
      link: `/profile/${clubId}`,
      entityType: 'club_roster_request',
      entityId: request.id,
      metadata: { kind: 'club_membership_approved' },
    });

    // Send email to athlete
    await sendEmail(
      request.athlete.email,
      'rosterApproved',
      {
        athleteName: request.athlete.firstName,
        clubName: request.club.firstName,
        position: request.position,
        message: responseMessage || 'Welcome to the team!'
      }
    );

    // Update athlete's profile with club info
    const athleteProfile = await Profile.findOne({ where: { userId: request.athleteId } });
    if (athleteProfile) {
      athleteProfile.club = request.club.firstName;
      await athleteProfile.save();
    }

    // Mark athlete's club verification and finalize `verified` if requirements met
    try {
      const { markClubVerified } = require('../utils/userVerification');
      const athleteUser = await User.findByPk(request.athleteId);
      if (athleteUser) {
        await markClubVerified(athleteUser);
      }
    } catch (e) {
      console.error('Failed to set athlete club verification:', e && e.message);
    }

    res.json({
      msg: 'Roster request approved',
      request
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Reject roster request
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseMessage } = req.body;
    const clubId = req.user.id;

    const request = await ClubRosterRequest.findByPk(requestId, {
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'club',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ error: 'Kërkesa nuk u gjet' });
    }

    if (request.clubId !== clubId) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Kërkesa është përpunuar tashmë' });
    }

    // Update request
    request.status = 'rejected';
    request.responseMessage = responseMessage;
    await request.save();

    // Notify athlete
    await createNotification({
      userId: request.athleteId,
      actorId: clubId,
      type: 'system',
      title: 'Përditësim i kërkesës',
      message: `${request.club.firstName} ka shqyrtuar kërkesën tuaj për formacion`,
      link: '/club-roster',
      entityType: 'club_roster_request',
      entityId: request.id,
      metadata: { kind: 'club_membership_rejected' },
    });

    // Send email to athlete
    await sendEmail(
      request.athlete.email,
      'rosterRejected',
      {
        athleteName: request.athlete.firstName,
        clubName: request.club.firstName,
        position: request.position,
        message: responseMessage || 'Thank you for your interest.'
      }
    );

    res.json({
      msg: 'Roster request rejected',
      request
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get club's approved roster
exports.getClubRoster = async (req, res) => {
  try {
    const { clubId } = req.params;

    const parsedClubId = parseInt(clubId, 10);
    if (!Number.isFinite(parsedClubId)) {
      return res.status(400).json({ error: 'ID e klubit është e pavlefshme' });
    }

    const roster = await ClubRosterRequest.findAll({
      where: {
        clubId: parsedClubId,
        status: 'approved'
      },
      include: [
        {
          model: User,
          as: 'athlete',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Profile,
            attributes: PROFILE_ROSTER_ATTRIBUTES
          }]
        }
      ],
      order: [['jerseyNumber', 'ASC']]
    });

    res.json(roster);
  } catch (error) {
    console.error('Get club roster error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Remove player from roster
exports.removeFromRoster = async (req, res) => {
  try {
    const { requestId } = req.params;
    const clubId = req.user.id;

    const request = await ClubRosterRequest.findByPk(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Regjistrimi në formacion nuk u gjet' });
    }

    if (request.clubId !== clubId) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }

    await request.destroy();

    // Notify athlete
    await createNotification({
      userId: request.athleteId,
      actorId: clubId,
      type: 'system',
      title: 'Përditësim i formacionit',
      message: 'Jeni hequr nga formacioni i klubit',
      link: '/profile',
      entityType: 'club_roster_request',
      entityId: request.id,
      metadata: { kind: 'club_membership_removed' },
    });

    res.json({ msg: 'Player removed from roster' });
  } catch (error) {
    console.error('Remove from roster error:', error);
    res.status(500).json({ error: error.message });
  }
};
