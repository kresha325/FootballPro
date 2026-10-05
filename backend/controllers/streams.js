// Stream/livestream controller removed
// Pranon video të regjistruar nga frontend dhe e ruan në uploads/streams
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const socketUtil = require('../utils/socket');
const cloudinary = require('../utils/cloudinary');
const Gallery = require('../models/Gallery');
const Post = require('../models/Post');
const { persistLiveReplay } = require('../utils/persistLiveReplay');
const {
  expireStaleLiveStreams,
  endOtherLiveStreamsForStreamer,
  isStreamStale,
} = require('../utils/streamLive');

exports.uploadRecording = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nuk u ngarkua asnjë skedar' });
    const { title, description, streamId } = req.body;
    const streamerId = req.user.id;
    let videoUrl = `/uploads/${req.file.filename}`;
    let publicId = null;

    const isCloudinaryEnabled = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    if (isCloudinaryEnabled) {
      const full = path.join(__dirname, '..', 'uploads', req.file.filename);
      const cloudRes = await cloudinary.uploader.upload(full, {
        resource_type: 'video',
        folder: 'live-replays',
      });
      videoUrl = cloudRes.secure_url;
      publicId = cloudRes.public_id;
      try {
        fs.unlinkSync(full);
      } catch (_e) {
        /* ignore */
      }
    }

    const parsedStreamId = streamId ? parseInt(streamId, 10) : null;
    const result = await persistLiveReplay({
      userId: streamerId,
      streamId: Number.isFinite(parsedStreamId) ? parsedStreamId : null,
      videoUrl,
      title: title || 'Regjistrim Live',
      description: description || '',
      publicId,
    });
    const stream = result.stream;
    console.log('[uploadRecording] live replay saved:', stream.id, stream.videoUrl);
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:updated', { id: stream.id });
      }
    } catch (e) {
      /* ignore */
    }
    res.json({
      success: true,
      stream,
      liveVideos: result.liveVideos,
      video: result.video,
    });
  } catch (err) {
    console.error('[uploadRecording] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

// Upload temporary recording (store in uploads/, but do not attach to Stream)
exports.uploadTemp = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nuk u ngarkua asnjë skedar' });
    const tempPath = `/uploads/${req.file.filename}`;
    // Do not create DB records here; return path for frontend preview/decide-share
    try { const io = socketUtil.getIo(); if (io) io.to('streams').emit('stream:tempUploaded', { path: tempPath }); } catch(e) {}
    res.json({ tempUrl: tempPath });
  } catch (err) {
    console.error('Upload temp error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete temporary upload by filename (safe delete)
exports.deleteTemp = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || filename.includes('/')) return res.status(400).json({ error: 'Emri i skedarit është i pavlefshëm' });
    const full = path.join(__dirname, '..', 'uploads', filename);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      return res.json({ message: 'U fshi' });
    }
    res.status(404).json({ error: 'Nuk u gjet' });
  } catch (err) {
    console.error('Delete temp error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Finalize a temporary upload: live replay (default) or gallery + post (saveAs: 'post')
exports.finalizeTemp = async (req, res) => {
  try {
    const { tempUrl, content, saveAs, streamId, title, description } = req.body;
    if (!tempUrl) return res.status(400).json({ error: 'tempUrl është i detyrueshëm' });
    // Accept cloud URLs directly
    let imageUrl = null;
    let videoUrl = null;
    const isCloudinaryEnabled = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (tempUrl.startsWith('/uploads/')) {
      const filename = tempUrl.replace('/uploads/', '');
      const full = path.join(__dirname, '..', 'uploads', filename);
      if (!fs.existsSync(full)) return res.status(404).json({ error: 'Skedari nuk u gjet' });
      const ext = path.extname(full).toLowerCase();
      const isVideo = /\.(mp4|mov|mkv|webm|avi)$/.test(ext);

      if (isCloudinaryEnabled) {
        const uploadOptions = {
          resource_type: isVideo ? 'video' : 'image',
          folder: 'gallery',
          transformation: [{ fetch_format: 'auto', quality: 'auto' }]
        };
        const cloudRes = await cloudinary.uploader.upload(full, uploadOptions);
        try { fs.unlinkSync(full); } catch (e) {}
        if (isVideo) videoUrl = cloudRes.secure_url; else imageUrl = cloudRes.secure_url;
      } else {
        // Move to uploads/gallery
        const destDir = path.join(__dirname, '..', 'uploads', 'gallery');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const destName = Date.now() + '-' + filename;
        const dest = path.join(destDir, destName);
        fs.renameSync(full, dest);
        const publicPath = `/uploads/gallery/${destName}`;
        if (isVideo) videoUrl = publicPath; else imageUrl = publicPath;
      }
    } else if (/^https?:\/\//.test(tempUrl)) {
      // Already a public URL (maybe Cloudinary)
      if (/\.(mp4|mov|mkv|webm|avi)(\?|$)/.test(tempUrl)) videoUrl = tempUrl; else imageUrl = tempUrl;
    } else {
      return res.status(400).json({ error: 'Formati i tempUrl nuk mbështetet' });
    }

    const mode = saveAs === 'post' ? 'post' : 'live';
    if (mode === 'live' && videoUrl) {
      const parsedStreamId = streamId ? parseInt(streamId, 10) : null;
      const result = await persistLiveReplay({
        userId: req.user.id,
        streamId: Number.isFinite(parsedStreamId) ? parsedStreamId : null,
        videoUrl,
        title: title || content || 'Regjistrim Live',
        description: description || '',
      });
      try {
        const io = socketUtil.getIo();
        if (io) {
          io.emit('stream:updated', { id: result.stream.id });
          io.to('streams').emit('stream:updated', { id: result.stream.id });
        }
      } catch (e) {
        /* ignore */
      }
      return res.json({
        saveAs: 'live',
        stream: result.stream,
        liveVideos: result.liveVideos,
        video: result.video,
      });
    }

    // Create gallery entry if media was produced
    let galleryItem = null;
    if (imageUrl || videoUrl) {
      galleryItem = await Gallery.create({
        userId: req.user.id,
        title: content || 'Live session',
        description: '',
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        type: videoUrl ? 'video' : 'photo',
        publicId: null,
      });
    }

    // Create post referencing the media
    const post = await Post.create({
      userId: req.user.id,
      content: content || '',
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
    });

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('post:created', { id: post.id });
      }
    } catch (e) {}

    res.json({ post, gallery: galleryItem });
  } catch (err) {
    console.error('Finalize temp error:', err);
    res.status(500).json({ error: err.message });
  }
};
// Nis ose përditëson stream WebRTC si live
exports.goLiveWebRTC = async (req, res) => {
  try {
    const streamerId = req.user.id;
    let stream = await Stream.findOne({ where: { streamerId, type: 'webrtc' } });
    if (!stream) {
      stream = await Stream.create({
        title: req.body.title || 'WebRTC Live',
        description: req.body.description || '',
        streamerId,
        isPremium: false,
        streamKey: generateStreamKey(),
        isLive: true,
        type: 'webrtc',
      });
      await endOtherLiveStreamsForStreamer(streamerId, stream.id);
    } else {
      stream.isLive = true;
      stream.title = req.body.title || 'WebRTC Live';
      stream.description = req.body.description || '';
      await stream.save();
      await endOtherLiveStreamsForStreamer(streamerId, stream.id);
    }
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
      }
    } catch (e) {}
    res.json({ message: 'Transmetimi WebRTC u nis', stream });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Jep stream key dhe URL për përdoruesin aktual
exports.getMyStreamInfo = async (req, res) => {
  try {
    const { ingestEnabled } = require('../utils/streamPublic');
    const stream = await Stream.findOne({
      where: { streamerId: req.user.id },
      order: [['updatedAt', 'DESC']],
    });
    const enabled = ingestEnabled();
    if (!enabled) {
      return res.json({
        ingestSupported: false,
        provider: 'livekit',
        streamKey: null,
        rtmpUrl: null,
        hlsUrl: null,
        message:
          'Native RTMP/OBS ingest is not available on this host. Go live with LiveKit in the app, or link a YouTube channel and broadcast from YouTube Studio.',
      });
    }
    if (!stream) {
      return res.status(404).json({
        ingestSupported: true,
        error: 'Create a stream before requesting an ingest key.',
      });
    }
    const serverIp = process.env.RTMP_SERVER_IP;
    res.json({
      ingestSupported: true,
      provider: 'rtmp',
      streamKey: stream.streamKey,
      rtmpUrl: `rtmp://${serverIp}:1935/live`,
      hlsUrl: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const { Stream, User, Profile, Match, Tournament } = require('../models');
const { Op } = require('sequelize');
const { normalizeYoutubeChannelId, youtubeLiveEmbedUrl } = require('../utils/youtubeChannel');
const { applyStreamStatus, deriveInitialStatus, currentStatus, STATUSES } = require('../utils/streamLifecycle');
const { serializeStream, canViewStream } = require('../utils/streamPublic');
const { notifyStreamFollowers } = require('../utils/streamNotifications');
const ClubMember = require('../models/ClubMember');

const STREAM_LIST_ATTRS = [
  'id',
  'title',
  'description',
  'streamerId',
  'isLive',
  'viewers',
  'isPremium',
  'type',
  'videoUrl',
  'youtubeChannelId',
  'status',
  'visibility',
  'provider',
  'providerId',
  'thumbnailUrl',
  'scheduledAt',
  'startedAt',
  'endedAt',
  'matchId',
  'tournamentId',
  'playerId',
  'clubId',
  'featured',
  'createdAt',
  'updatedAt',
];

function toInt(value) {
  if (value == null || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function streamerInclude() {
  return {
    model: User,
    as: 'streamer',
    attributes: ['id', 'firstName', 'lastName', 'verified'],
    include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club', 'youtubeChannelId'] }],
  };
}

function decorateStreamer(s) {
  if (!s.streamer) {
    s.streamer = { firstName: 'I panjohur', lastName: '', photoUrl: null };
    return s;
  }
  if (s.streamer.Profile && s.streamer.Profile.profilePhoto) {
    const photo = s.streamer.Profile.profilePhoto;
    s.streamer.photoUrl = photo.startsWith('/uploads/') ? photo : photo;
  } else {
    s.streamer.photoUrl = null;
  }
  return s;
}

function presentStream(stream, viewerId) {
  const s = serializeStream(stream, { viewerId });
  if (isStreamStale(s)) s.isLive = false;
  if (s.youtubeChannelId) s.youtubeEmbedUrl = youtubeLiveEmbedUrl(s.youtubeChannelId);
  return decorateStreamer(s);
}

async function assertAssociation(user, { matchId, tournamentId, playerId, clubId }) {
  if (matchId) {
    const match = await Match.findByPk(matchId);
    if (!match) return { ok: false, status: 400, error: 'Match not found' };
  }
  if (tournamentId) {
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return { ok: false, status: 400, error: 'Competition not found' };
  }
  if (playerId && Number(playerId) !== Number(user.id) && user.role !== 'admin') {
    if (user.role === 'club') {
      const member = await ClubMember.findOne({
        where: { clubId: user.id, athleteId: playerId, status: 'approved' },
      });
      if (!member) return { ok: false, status: 403, error: 'You cannot attach this player' };
    } else {
      return { ok: false, status: 403, error: 'You cannot attach this player' };
    }
  }
  if (clubId && Number(clubId) !== Number(user.id) && user.role !== 'admin') {
    const member = await ClubMember.findOne({
      where: { clubId, athleteId: user.id, status: 'approved' },
    });
    if (!member) return { ok: false, status: 403, error: 'You cannot attach this club' };
  }
  return { ok: true };
}

function listWhere(query, viewer) {
  const where = {};
  const and = [];
  const section = String(query.section || '').toLowerCase();
  if (query.isLive === 'true' || section === 'live') where.isLive = true;
  if (section === 'upcoming') {
    where.status = { [Op.in]: ['scheduled', 'ready'] };
  } else if (section === 'ended') {
    where.status = { [Op.in]: ['ended', 'processing', 'available'] };
  } else if (query.status && STATUSES.includes(String(query.status))) {
    where.status = String(query.status);
  }
  if (section === 'featured' || query.featured === 'true') where.featured = true;
  const userId = toInt(query.userId);
  const matchId = toInt(query.matchId);
  const tournamentId = toInt(query.tournamentId);
  const clubId = toInt(query.clubId);
  const playerId = toInt(query.playerId);
  if (userId) where.streamerId = userId;
  if (matchId) where.matchId = matchId;
  if (tournamentId) where.tournamentId = tournamentId;
  if (clubId) where.clubId = clubId;
  if (playerId) where.playerId = playerId;

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && !Number.isNaN(from.getTime())) and.push({ createdAt: { [Op.gte]: from } });
  if (to && !Number.isNaN(to.getTime())) and.push({ createdAt: { [Op.lte]: to } });

  const visibilityOr = [{ visibility: 'public' }, { visibility: null }];
  if (viewer?.id) visibilityOr.push({ streamerId: viewer.id });
  and.push({ [Op.or]: visibilityOr });
  if (and.length) where[Op.and] = and;
  return where;
}

function isMediasoupInternalAuthorized(req) {
  const configuredToken = process.env.MEDIASOUP_ADMIN_TOKEN;
  if (!configuredToken) {
    return false;
  }

  const authHeader = req.header('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return bearerToken && bearerToken === configuredToken;
}

exports.createStream = async (req, res) => {
  try {
    const { title, description, isPremium, youtubeChannelId: bodyChannel } = req.body;
    const streamerId = req.user.id;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return res.status(400).json({ error: 'Title is required' });

    const { hasTier } = require('../utils/subscriptionAccess');
    if (!hasTier(req.user, 'pro')) {
      return res.status(403).json({
        error: 'Live streaming kërkon planin Pro.',
        code: 'PLAN_REQUIRED',
        requiredTier: 'pro',
      });
    }

    const trimmedBody =
      bodyChannel !== undefined && bodyChannel !== null ? String(bodyChannel).trim() : '';
    const playbackSource = String(req.body.playbackSource || 'auto').toLowerCase();
    let youtubeChannelId = null;

    if (trimmedBody) {
      youtubeChannelId = normalizeYoutubeChannelId(trimmedBody);
      if (!youtubeChannelId) {
        return res.status(400).json({ error: 'YouTube channel ID është i pavlefshëm (pritet UC... ose link /channel/UC...)' });
      }
    } else if (playbackSource !== 'livekit') {
      const prof = await Profile.findOne({
        where: { userId: streamerId },
        attributes: ['youtubeChannelId'],
      });
      youtubeChannelId = normalizeYoutubeChannelId(prof?.youtubeChannelId);
    }

    const visibility = ['public', 'unlisted', 'private'].includes(req.body.visibility)
      ? req.body.visibility
      : (req.body.isPublic === false ? 'private' : 'public');
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (req.body.scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: 'scheduledAt is invalid' });
    }
    const status = deriveInitialStatus({ scheduledAt });
    if (!status) return res.status(400).json({ error: 'scheduledAt is invalid' });

    const matchId = toInt(req.body.matchId);
    const tournamentId = toInt(req.body.tournamentId);
    const playerId = toInt(req.body.playerId);
    const clubId = toInt(req.body.clubId);
    const association = await assertAssociation(req.user, { matchId, tournamentId, playerId, clubId });
    if (!association.ok) return res.status(association.status).json({ error: association.error });

    const provider = playbackSource === 'youtube' || (youtubeChannelId && playbackSource !== 'livekit')
      ? 'youtube'
      : 'livekit';

    const stream = await Stream.create({
      title: cleanTitle.slice(0, 255),
      description: description ? String(description).slice(0, 5000) : '',
      streamerId,
      isPremium: !!isPremium,
      isLive: false,
      streamKey: generateStreamKey(),
      youtubeChannelId,
      status,
      visibility,
      provider,
      providerId: null,
      thumbnailUrl: req.body.thumbnailUrl ? String(req.body.thumbnailUrl).slice(0, 512) : null,
      scheduledAt,
      matchId,
      tournamentId,
      playerId,
      clubId,
      featured: req.body.featured === true || req.body.featured === 'true',
    });
    stream.providerId = provider === 'livekit' ? `stream-${stream.id}` : (req.body.youtubeVideoId ? String(req.body.youtubeVideoId).slice(0, 32) : null);
    await stream.save();

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:created', { id: stream.id });
        io.to('streams').emit('stream:created', { id: stream.id });
      }
    } catch (e) {}
    res.status(201).json(presentStream(stream, req.user.id));
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A stream for this provider resource already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getStreams = async (req, res) => {
  try {
    await expireStaleLiveStreams();

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const whereClause = listWhere(req.query, req.user);
    const streams = await Stream.findAll({
      where: whereClause,
      attributes: STREAM_LIST_ATTRS,
      include: [streamerInclude()],
      order: [
        ['isLive', 'DESC'],
        ['featured', 'DESC'],
        ['viewers', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });
    const liveOnly = req.query.isLive === 'true' || String(req.query.section || '') === 'live';
    const rows = streams
      .map((stream) => presentStream(stream, req.user?.id))
      .filter((s) => (liveOnly ? s.isLive : true));
    res.json(rows);
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDiscovery = async (req, res) => {
  try {
    await expireStaleLiveStreams();
    const base = {
      matchId: req.query.matchId,
      tournamentId: req.query.tournamentId,
      clubId: req.query.clubId,
      from: req.query.from,
      to: req.query.to,
    };
    const load = async (section, limit) => {
      const rows = await Stream.findAll({
        where: listWhere({ ...base, section }, req.user),
        attributes: STREAM_LIST_ATTRS,
        include: [streamerInclude()],
        order: section === 'upcoming'
          ? [['scheduledAt', 'ASC'], ['createdAt', 'DESC']]
          : [['isLive', 'DESC'], ['featured', 'DESC'], ['endedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
      });
      return rows.map((row) => presentStream(row, req.user?.id)).filter((row) => (
        section === 'live' ? row.isLive : true
      ));
    };
    const [live, upcoming, ended, featured] = await Promise.all([
      load('live', 12),
      load('upcoming', 12),
      load('ended', 12),
      load('featured', 12),
    ]);
    res.json({ live, upcoming, ended, featured });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStream = async (req, res) => {
  try {
    await expireStaleLiveStreams();

    const { id } = req.params;
    const stream = await Stream.findByPk(id, {
      attributes: STREAM_LIST_ATTRS,
      include: [streamerInclude()],
    });
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });
    if (!canViewStream(stream, req.user?.id)) {
      return res.status(404).json({ error: 'Transmetimi nuk u gjet' });
    }

    if (stream.isPremium && !req.user?.premium && Number(stream.streamerId) !== Number(req.user?.id)) {
      return res.status(403).json({ error: 'Transmetimi premium kërkon abonim' });
    }

    if (isStreamStale(stream)) {
      stream.isLive = false;
      stream.viewers = 0;
      stream.status = stream.status === 'live' ? 'ended' : stream.status;
      stream.endedAt = stream.endedAt || new Date();
      await stream.save();
    }
    res.json(presentStream(stream, req.user?.id));
  } catch (error) {
    console.error('Get stream error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.startStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }

    try {
      applyStreamStatus(stream, 'live');
    } catch (err) {
      return res.status(err.statusCode || 409).json({ error: err.message });
    }
    await stream.save();

    await endOtherLiveStreamsForStreamer(stream.streamerId, stream.id);
    notifyStreamFollowers(stream.streamerId, 'stream_started', stream).catch(() => {});

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
      }
    } catch (e) {}
    res.json({ message: 'Stream started', stream: presentStream(stream, req.user.id) });
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({ error: error.message });
  }
};

/** Broadcaster heartbeat — mbaj stream-in live derisa dërgohet çdo ~30s. */
exports.heartbeatStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    if (!stream.isLive) {
      return res.status(400).json({ error: 'Stream is not live' });
    }

    const rawViewers = req.body?.viewers;
    if (rawViewers !== undefined && rawViewers !== null && rawViewers !== '') {
      const viewers = Math.max(0, Math.floor(Number(rawViewers)));
      if (Number.isFinite(viewers)) {
        stream.viewers = viewers;
      }
    }

    // Touch updatedAt so isStreamStale does not expire an active LiveKit session
    stream.set('updatedAt', new Date());
    await stream.save();

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:viewers', {
          id: stream.id,
          viewers: stream.viewers,
        });
      }
    } catch (_e) {
      /* ignore */
    }

    res.json({ ok: true, id: stream.id, viewers: stream.viewers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveLiveReplay = async (req, res) => {
  try {
    const { id } = req.params;
    const { videoUrl, title, description, thumbnailUrl, duration } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    const result = await persistLiveReplay({
      userId: req.user.id,
      streamId: stream.id,
      videoUrl,
      title: title || stream.title,
      description: description || stream.description || '',
      thumbnailUrl: thumbnailUrl || null,
      duration,
    });
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
      }
    } catch (e) {
      /* ignore */
    }
    res.json({
      success: true,
      stream: result.stream,
      liveVideos: result.liveVideos,
      video: result.video,
    });
  } catch (error) {
    console.error('saveLiveReplay error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.endStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    if (['ended', 'processing', 'available', 'cancelled'].includes(currentStatus(stream))) {
      return res.json({ message: 'Stream ended', stream: presentStream(stream, req.user.id) });
    }

    try {
      applyStreamStatus(stream, 'ended');
      if (stream.videoUrl) {
        applyStreamStatus(stream, 'processing');
        applyStreamStatus(stream, 'available');
      }
    } catch (err) {
      return res.status(err.statusCode || 409).json({ error: err.message });
    }
    await stream.save();
    notifyStreamFollowers(stream.streamerId, 'stream_ended', stream).catch(() => {});
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:ended', { id: stream.id });
        io.to('streams').emit('stream:ended', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:ended', { id: stream.id });
      }
    } catch (e) {}
    res.json({ message: 'Stream ended', stream: presentStream(stream, req.user.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** @deprecated Internal callback for legacy mediasoup-server. Prefer LiveKit flows. */
exports.updateViewersInternal = async (req, res) => {
  try {
    if (!isMediasoupInternalAuthorized(req)) {
      return res.status(401).json({ error: 'Thirrje mediasoup e paautorizuar' });
    }

    const { id } = req.params;
    const rawViewers = req.body.viewers;
    const viewers = Number.isFinite(Number(rawViewers)) ? Math.max(0, Number(rawViewers)) : NaN;

    if (Number.isNaN(viewers)) {
      return res.status(400).json({ error: 'Invalid viewers value' });
    }

    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });

    stream.viewers = viewers;
    await Stream.update(
      { viewers },
      { where: { id: stream.id }, silent: true }
    );

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:viewers', { id: stream.id, viewers: stream.viewers });
      }
    } catch (e) {}

    res.json({ message: 'Viewers updated', id: stream.id, viewers: stream.viewers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** @deprecated Internal callback for legacy mediasoup-server. Prefer LiveKit flows. */
exports.endStreamInternal = async (req, res) => {
  try {
    if (!isMediasoupInternalAuthorized(req)) {
      return res.status(401).json({ error: 'Thirrje mediasoup e paautorizuar' });
    }

    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream) {
      return res.status(404).json({ error: 'Transmetimi nuk u gjet' });
    }

    stream.isLive = false;
    await stream.save();

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:ended', { id: stream.id });
        io.to('streams').emit('stream:ended', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:ended', { id: stream.id });
      }
    } catch (e) {}

    res.json({ message: 'Stream ended by mediasoup', id: stream.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.joinStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || !canViewStream(stream, req.user?.id)) {
      return res.status(404).json({ error: 'Transmetimi nuk u gjet' });
    }

    if (stream.isPremium && !req.user.premium && Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Transmetimi premium kërkon abonim' });
    }

    stream.viewers = (Number(stream.viewers) || 0) + 1;
    await stream.save();
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:viewers', { id: stream.id, viewers: stream.viewers });
      }
    } catch (e) {}
    res.json({ message: 'Joined stream', viewers: stream.viewers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.leaveStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });

    const current = Number(stream.viewers) || 0;
    if (current > 0) {
      stream.viewers = current - 1;
      await stream.save();
      try {
        const io = socketUtil.getIo();
        if (io) {
          io.emit('stream:updated', { id: stream.id });
          io.to('streams').emit('stream:updated', { id: stream.id });
          io.to(`stream:${stream.id}`).emit('stream:viewers', { id: stream.id, viewers: stream.viewers });
        }
      } catch (e) {}
    }
    res.json({ message: 'Left stream', viewers: stream.viewers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelStream = async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    applyStreamStatus(stream, 'cancelled');
    await stream.save();
    res.json({ message: 'Stream cancelled', stream: presentStream(stream, req.user.id) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.failStream = async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    applyStreamStatus(stream, 'failed');
    await stream.save();
    res.json({ message: 'Stream marked failed', stream: presentStream(stream, req.user.id) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

function generateStreamKey() {
  return crypto.randomBytes(24).toString('hex');
}