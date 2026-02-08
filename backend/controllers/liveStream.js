const { LiveStream, User, Profile } = require('../models');
const { Op } = require('sequelize');

// Start a live stream
exports.startLiveStream = async (req, res) => {
  try {
    const { title, description, isPublic } = req.body;
    const userId = req.user.id;
    const startedAt = new Date();
    const streamKey = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const liveStream = await LiveStream.create({
      userId,
      title,
      description,
      startedAt,
      streamKey,
      isPublic: isPublic ?? true,
      status: 'live',
      maxDuration: 45,
    });
    res.json({ liveStream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// End a live stream
exports.endLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    const liveStream = await LiveStream.findByPk(streamId);
    if (!liveStream || liveStream.status !== 'live') {
      return res.status(404).json({ error: 'Live stream not found or already ended' });
    }
    liveStream.status = 'ended';
    liveStream.endedAt = new Date();
    await liveStream.save();
    res.json({ msg: 'Live stream ended', liveStream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all active live streams
exports.getActiveLiveStreams = async (req, res) => {
  try {
    const streams = await LiveStream.findAll({
      where: {
        status: 'live',
        endedAt: { [Op.or]: [null, { [Op.gt]: new Date(Date.now() - 45 * 60 * 1000)] } },
      },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'profilePhoto'] }],
      order: [['startedAt', 'DESC']],
    });
    res.json({ streams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get stream details
exports.getLiveStreamDetails = async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await LiveStream.findByPk(streamId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'profilePhoto'] }],
    });
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json({ stream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update viewers count
exports.updateViewersCount = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { viewersCount } = req.body;
    const stream = await LiveStream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    stream.viewersCount = viewersCount;
    await stream.save();
    res.json({ stream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Save live video after stream ends
exports.saveLiveVideo = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { videoUrl, thumbnailUrl, duration } = req.body;
    const liveStream = await LiveStream.findByPk(streamId);
    if (!liveStream || liveStream.status !== 'ended') {
      return res.status(404).json({ error: 'Live stream not found or not ended' });
    }
    const profile = await Profile.findOne({ where: { userId: liveStream.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const liveVideos = Array.isArray(profile.liveVideos) ? profile.liveVideos : [];
    liveVideos.push({
      url: videoUrl,
      title: liveStream.title,
      thumbnail: thumbnailUrl,
      duration,
      date: new Date(),
    });
    profile.liveVideos = liveVideos;
    await profile.save();
    res.json({ msg: 'Live video saved', liveVideos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
