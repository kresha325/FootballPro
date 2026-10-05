const { Op } = require('sequelize');
const { Stream, User, Profile, LiveStream } = require('../models');
const { applyStreamStatus } = require('../utils/streamLifecycle');
const { serializeStream } = require('../utils/streamPublic');
const { persistLiveReplay } = require('../utils/persistLiveReplay');
const crypto = require('crypto');

const serverError = (res, err) =>
  res.status(500).json({ msg: 'Gabim në server', error: err?.message });

function asLegacy(stream) {
  const json = serializeStream(stream, { viewerId: stream.streamerId });
  return {
    id: json.id,
    userId: json.streamerId,
    title: json.title,
    description: json.description,
    startedAt: json.startedAt,
    endedAt: json.endedAt,
    status: json.status === 'live' ? 'live' : json.status === 'scheduled' ? 'scheduled' : 'ended',
    viewersCount: json.viewers || 0,
    isPublic: json.visibility !== 'private',
    canonical: true,
  };
}

/**
 * Legacy /api/live-stream writes land on the canonical Stream table.
 * Older LiveStream rows are only read or closed when no canonical row matches.
 */
exports.startLiveStream = async (req, res) => {
  try {
    const { hasTier } = require('../utils/subscriptionAccess');
    if (!hasTier(req.user, 'pro')) {
      return res.status(403).json({
        msg: 'Live streaming kërkon planin Pro.',
        code: 'PLAN_REQUIRED',
        requiredTier: 'pro',
      });
    }
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ msg: 'Title is required' });
    const stream = await Stream.create({
      title: title.slice(0, 255),
      description: req.body?.description ? String(req.body.description).slice(0, 5000) : '',
      streamerId: req.user.id,
      isLive: false,
      streamKey: crypto.randomBytes(24).toString('hex'),
      status: 'ready',
      visibility: req.body?.isPublic === false ? 'private' : 'public',
      provider: 'livekit',
    });
    applyStreamStatus(stream, 'live');
    stream.providerId = `stream-${stream.id}`;
    await stream.save();
    res.json({ liveStream: asLegacy(stream), stream: serializeStream(stream, { viewerId: req.user.id }) });
  } catch (err) {
    serverError(res, err);
  }
};

exports.endLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.findByPk(streamId);
    if (stream) {
      if (Number(stream.streamerId) !== Number(req.user.id)) {
        return res.status(403).json({ msg: 'Nuk je i autorizuar' });
      }
      if (stream.status === 'live' || stream.isLive) {
        applyStreamStatus(stream, 'ended');
        await stream.save();
      }
      return res.json({ msg: 'Live stream u mbyll', liveStream: asLegacy(stream) });
    }

    const liveStream = await LiveStream.findByPk(streamId);
    if (!liveStream || liveStream.status !== 'live') {
      return res.status(404).json({ msg: 'Live stream nuk u gjet ose është mbyllur tashmë' });
    }
    if (liveStream.userId && Number(liveStream.userId) !== Number(req.user.id)) {
      return res.status(403).json({ msg: 'Nuk je i autorizuar' });
    }
    liveStream.status = 'ended';
    liveStream.endedAt = new Date();
    await liveStream.save();
    res.json({ msg: 'Live stream u mbyll', liveStream });
  } catch (err) {
    serverError(res, err);
  }
};

exports.getActiveLiveStreams = async (req, res) => {
  try {
    const streams = await Stream.findAll({
      where: {
        isLive: true,
        [Op.or]: [{ visibility: 'public' }, { visibility: null }],
      },
      include: [{
        model: User,
        as: 'streamer',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['profilePhoto'] }],
      }],
      order: [['startedAt', 'DESC']],
      limit: 50,
    });
    res.json({
      streams: streams.map((row) => ({
        ...asLegacy(row),
        user: row.streamer || null,
      })),
    });
  } catch (err) {
    serverError(res, err);
  }
};

exports.getLiveStreamDetails = async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.findByPk(streamId, {
      include: [{
        model: User,
        as: 'streamer',
        attributes: ['id', 'firstName', 'lastName'],
      }],
    });
    if (stream) {
      if ((stream.visibility || 'public') === 'private' && Number(stream.streamerId) !== Number(req.user?.id)) {
        return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
      }
      const json = serializeStream(stream, { viewerId: req.user?.id });
      return res.json({ stream: { ...asLegacy(stream), ...json, user: stream.streamer || null } });
    }
    const legacy = await LiveStream.findByPk(streamId);
    if (!legacy) return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
    if (legacy.streamKey) legacy.streamKey = undefined;
    res.json({ stream: legacy });
  } catch (err) {
    serverError(res, err);
  }
};

exports.updateViewersCount = async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.streamId);
    if (!stream) return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
    if (Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ msg: 'Nuk je i autorizuar' });
    }
    const viewers = Math.max(0, Math.floor(Number(req.body?.viewersCount)));
    if (!Number.isFinite(viewers)) return res.status(400).json({ msg: 'viewersCount invalid' });
    stream.viewers = viewers;
    await stream.save();
    res.json({ stream: asLegacy(stream) });
  } catch (err) {
    serverError(res, err);
  }
};

exports.saveLiveVideo = async (req, res) => {
  try {
    const { videoUrl, thumbnailUrl, duration } = req.body || {};
    if (!videoUrl) return res.status(400).json({ msg: 'videoUrl required' });
    const stream = await Stream.findByPk(req.params.streamId);
    if (!stream || Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ msg: 'Nuk je i autorizuar' });
    }
    const result = await persistLiveReplay({
      userId: req.user.id,
      streamId: stream.id,
      videoUrl,
      title: stream.title,
      thumbnailUrl,
      duration,
    });
    res.json({ msg: 'Video live u ruajt', liveVideos: result.liveVideos, stream: result.stream });
  } catch (err) {
    serverError(res, err);
  }
};
