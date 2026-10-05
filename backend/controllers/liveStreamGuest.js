const LiveStreamGuest = require('../models/LiveStreamGuest');
const Stream = require('../models/Stream');

exports.inviteGuest = async (req, res) => {
  try {
    const { streamId, userId } = req.body;
    const stream = await Stream.findByPk(streamId);
    if (!stream || Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    const guest = await LiveStreamGuest.create({
      streamId,
      userId,
      invitedBy: req.user.id,
    });
    res.status(201).json(guest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite guest' });
  }
};

exports.updateGuestStatus = async (req, res) => {
  try {
    const { guestId } = req.params;
    const { status } = req.body;
    const guest = await LiveStreamGuest.findByPk(guestId);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    const isParty = Number(guest.userId) === Number(req.user.id) || Number(guest.invitedBy) === Number(req.user.id);
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    guest.status = status;
    if (status === 'accepted') guest.joinedAt = new Date();
    await guest.save();
    res.status(200).json(guest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update guest status' });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const { streamId } = req.params;
    const guests = await LiveStreamGuest.findAll({ where: { streamId } });
    res.status(200).json(guests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
};
