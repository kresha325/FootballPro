const { LiveStream, User, Profile } = require('../models');
const { Op } = require('sequelize');

const serverError = (res, err) =>
  res.status(500).json({ msg: 'Gabim në server', error: err?.message });

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
    serverError(res, err);
  }
};

// End a live stream
exports.endLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    const liveStream = await LiveStream.findByPk(streamId);
    if (!liveStream || liveStream.status !== 'live') {
      return res.status(404).json({ msg: 'Live stream nuk u gjet ose është mbyllur tashmë' });
    }
    liveStream.status = 'ended';
    liveStream.endedAt = new Date();
    await liveStream.save();
    res.json({ msg: 'Live stream u mbyll', liveStream });
  } catch (err) {
    serverError(res, err);
  }
};

// Get all active live streams
exports.getActiveLiveStreams = async (req, res) => {
  try {
    const streams = await LiveStream.findAll({
      where: {
        status: 'live',
        endedAt: { [Op.or]: [null, { [Op.gt]: new Date(Date.now() - 45 * 60 * 1000) }] },
      },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'profilePhoto'] }],
      order: [['startedAt', 'DESC']],
    });
    res.json({ streams });
  } catch (err) {
    serverError(res, err);
  }
};

// Get stream details
exports.getLiveStreamDetails = async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await LiveStream.findByPk(streamId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'profilePhoto'] }],
    });
    if (!stream) return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
    res.json({ stream });
  } catch (err) {
    serverError(res, err);
  }
};

// Update viewers count
exports.updateViewersCount = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { viewersCount } = req.body;
    const stream = await LiveStream.findByPk(streamId);
    if (!stream) return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
    stream.viewersCount = viewersCount;
    await stream.save();
    res.json({ stream });
  } catch (err) {
    serverError(res, err);
  }
};

// Save live video after stream ends
exports.saveLiveVideo = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { videoUrl, thumbnailUrl, duration } = req.body;
    const liveStream = await LiveStream.findByPk(streamId);
    if (!liveStream || liveStream.status !== 'ended') {
      return res.status(404).json({ msg: 'Live stream nuk u gjet ose nuk është mbyllur' });
    }
    const profile = await Profile.findOne({ where: { userId: liveStream.userId } });
    if (!profile) return res.status(404).json({ msg: 'Profili nuk u gjet' });
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
    res.json({ msg: 'Video live u ruajt', liveVideos });
  } catch (err) {
    serverError(res, err);
  }
};
