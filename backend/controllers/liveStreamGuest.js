const LiveStreamGuest = require('../models/LiveStreamGuest');
const Stream = require('../models/Stream');
const User = require('../models/User');
const { canViewStream } = require('../utils/streamPublic');
const {
  CHANNELS: COMMUNICATION_CHANNELS,
  authorizeMinorDirectContact,
} = require('../utils/minorCommunicationPolicy');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');

function isPlatformAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function guestView(row) {
  const value = row?.toJSON ? row.toJSON() : { ...row };
  // The inviter is operational metadata; only the owner/admin receives full rows.
  delete value.invitedBy;
  return value;
}

exports.inviteGuest = async (req, res) => {
  try {
    const streamId = Number(req.body?.streamId);
    const userId = Number(req.body?.userId);
    if (!Number.isInteger(streamId) || streamId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid stream or guest' });
    }
    const stream = await Stream.findByPk(streamId);
    if (!stream || (Number(stream.streamerId) !== Number(req.user.id) && !isPlatformAdmin(req.user))) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    if (Number(req.user.id) === userId) return res.status(400).json({ error: 'Cannot invite yourself' });
    const invitee = await User.findByPk(userId);
    if (!invitee || invitee.deletedAt || invitee.bannedAt) return res.status(404).json({ error: 'Guest not found' });

    // A block lookup failure must not permit a potentially unwanted live invitation.
    const { isEitherBlocked } = require('./moderation');
    try {
      if (await isEitherBlocked(req.user.id, userId)) {
        return res.status(403).json({ error: 'Invitation unavailable' });
      }
    } catch {
      return res.status(503).json({ error: 'Unable to verify invitation permissions' });
    }
    let childPermission;
    try {
      childPermission = await authorizeMinorDirectContact({
        actorId: req.user.id,
        targetId: userId,
        channel: COMMUNICATION_CHANNELS.PRIVATE_LIVE_INVITATION,
        User,
        ClubMember,
        ClubStaff,
        GuardianConsent,
      });
    } catch {
      return res.status(503).json({ error: 'Unable to verify invitation permissions' });
    }
    if (!childPermission.allowed) {
      return res.status(childPermission.status || 403).json({
        code: childPermission.reason || 'GUARDIAN_COMMUNICATION_CONSENT_REQUIRED',
        error: 'Guardian approval and an active club assignment are required',
      });
    }

    const existing = await LiveStreamGuest.findOne({ where: { streamId, userId } });
    if (existing) return res.status(409).json({ error: 'Guest has already been invited' });
    const guest = await LiveStreamGuest.create({
      streamId,
      userId,
      invitedBy: req.user.id,
    });
    res.status(201).json(guest);
  } catch {
    res.status(500).json({ error: 'Failed to invite guest' });
  }
};

exports.updateGuestStatus = async (req, res) => {
  try {
    const { guestId } = req.params;
    const { status } = req.body;
    const guest = await LiveStreamGuest.findByPk(guestId);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    if (!['accepted', 'declined'].includes(String(status || '').toLowerCase())) {
      return res.status(400).json({ error: 'Invalid invitation status' });
    }
    if (Number(guest.userId) !== Number(req.user.id) || guest.status !== 'pending') {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    guest.status = String(status).toLowerCase();
    if (guest.status === 'accepted') guest.joinedAt = new Date();
    await guest.save();
    res.status(200).json(guest);
  } catch {
    res.status(500).json({ error: 'Failed to update guest status' });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    const guests = await LiveStreamGuest.findAll({ where: { streamId } });
    const viewerId = Number(req.user.id);
    const owner = Number(stream.streamerId) === viewerId;
    const admin = isPlatformAdmin(req.user);
    const ownInvite = guests.some((guest) => Number(guest.userId) === viewerId);
    if (!canViewStream(stream, viewerId) && !owner && !admin && !ownInvite) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    if (owner || admin) return res.status(200).json(guests);

    // Public stream viewers only need the accepted guest list; pending invitations
    // are private. An invitee may additionally see their own pending invitation.
    const visible = guests.filter((guest) => guest.status === 'accepted' || Number(guest.userId) === viewerId);
    return res.status(200).json(visible.map(guestView));
  } catch {
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
};
