// Stream/livestream controller removed
// Pranon video të regjistruar nga frontend dhe e ruan në uploads/streams
const path = require('path');
const fs = require('fs');
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
    const streamerId = req.user.id;
    let stream = await Stream.findOne({ where: { streamerId } });
    if (!stream) {
      // Krijo stream nëse nuk ekziston
      stream = await Stream.create({
        title: 'My Stream',
        description: '',
        streamerId,
        isPremium: false,
        streamKey: generateStreamKey(),
      });
    }
    // Konfiguro këtu IP ose domain të serverit tënd RTMP/HLS
    const serverIp = process.env.RTMP_SERVER_IP || 'localhost';
    const rtmpUrl = `rtmp://${serverIp}:1935/live`;
    const hlsUrl = `https://${serverIp}:5098/hls/${stream.streamKey}.m3u8`;
    res.json({
      streamKey: stream.streamKey,
      rtmpUrl,
      hlsUrl,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const { Stream, User, Profile } = require('../models');
const { Op } = require('sequelize');
const { normalizeYoutubeChannelId, youtubeLiveEmbedUrl } = require('../utils/youtubeChannel');

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

    const streamKey = generateStreamKey();

    const stream = await Stream.create({
      title,
      description,
      streamerId,
      isPremium: isPremium || false,
      streamKey,
      youtubeChannelId,
    });

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:created', { id: stream.id });
        io.to('streams').emit('stream:created', { id: stream.id });
      }
    } catch (e) {}
    const json = stream.toJSON ? stream.toJSON() : stream;
    if (json.youtubeChannelId) {
      json.youtubeEmbedUrl = youtubeLiveEmbedUrl(json.youtubeChannelId);
    }
    res.status(201).json(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStreams = async (req, res) => {
  try {
    await expireStaleLiveStreams();

    const { isLive, limit = 20, userId } = req.query;
    const whereClause = {};
    if (isLive === 'true') {
      whereClause.isLive = true;
    }
    if (userId) {
      whereClause.streamerId = userId;
    }
    const streams = await Stream.findAll({
      where: whereClause,
      attributes: [
        'id',
        'title',
        'description',
        'streamerId',
        'isLive',
        'viewers',
        'isPremium',
        'type',
        'streamKey',
        'videoUrl',
        'youtubeChannelId',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: User,
          as: 'streamer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club', 'youtubeChannelId'] }],
        },
      ],
      order: [
        ['isLive', 'DESC'],
        ['viewers', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: parseInt(limit),
    });
    // Shto hlsUrl për çdo stream live
    const streamsWithHls = streams.map(stream => {
      const s = stream.toJSON ? stream.toJSON() : stream;
      if (isStreamStale(s)) {
        s.isLive = false;
      }
      if (s.isLive && s.streamKey) {
        s.hlsUrl = `/live/${s.streamKey}/index.m3u8`;
      }
      if (s.youtubeChannelId) {
        s.youtubeEmbedUrl = youtubeLiveEmbedUrl(s.youtubeChannelId);
      }
      // Siguro që gjithmonë të kthehet një objekt streamer me photoUrl
      if (!s.streamer) {
        s.streamer = { firstName: 'I panjohur', lastName: '', photoUrl: null };
      } else if (s.streamer.Profile && s.streamer.Profile.profilePhoto) {
        s.streamer.photoUrl = s.streamer.Profile.profilePhoto.startsWith('/uploads/')
          ? `https://localhost:5098${s.streamer.Profile.profilePhoto}`
          : s.streamer.Profile.profilePhoto;
      } else {
        s.streamer.photoUrl = null;
      }
      return s;
    })
      .filter((s) => (isLive === 'true' ? s.isLive : true));
    res.json(streamsWithHls);
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStream = async (req, res) => {
  try {
    await expireStaleLiveStreams();

    const { id } = req.params;
    const stream = await Stream.findByPk(id, {
      attributes: [
        'id',
        'title',
        'description',
        'streamerId',
        'isLive',
        'viewers',
        'isPremium',
        'type',
        'streamKey',
        'videoUrl',
        'youtubeChannelId',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: User,
          as: 'streamer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club', 'youtubeChannelId'] }],
        },
      ],
    });
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });

    // Check if premium stream and user is not premium
    if (stream.isPremium && !req.user?.premium) {
      return res.status(403).json({ error: 'Transmetimi premium kërkon abonim' });
    }

    const out = stream.toJSON ? stream.toJSON() : stream;
    if (isStreamStale(out)) {
      stream.isLive = false;
      stream.viewers = 0;
      await stream.save();
      out.isLive = false;
      out.viewers = 0;
    }
    if (out.youtubeChannelId) {
      out.youtubeEmbedUrl = youtubeLiveEmbedUrl(out.youtubeChannelId);
    }
    res.json(out);
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

    stream.isLive = true;
    await stream.save();

    await endOtherLiveStreamsForStreamer(stream.streamerId, stream.id);

    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
      }
    } catch (e) {}
    res.json({ message: 'Stream started', stream });
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

    await stream.save();

    res.json({ ok: true, id: stream.id });
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
    res.json({ message: 'Stream ended' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });

    if (stream.isPremium && !req.user.premium) {
      return res.status(403).json({ error: 'Transmetimi premium kërkon abonim' });
    }

    stream.viewers += 1;
    await stream.save();
    try {
      const io = socketUtil.getIo();
      if (io) {
        io.emit('stream:updated', { id: stream.id });
        io.to('streams').emit('stream:updated', { id: stream.id });
        io.to(`stream:${stream.id}`).emit('stream:viewers', { id: stream.id, viewers: stream.viewers });
      }
    } catch (e) {}
    res.json({ message: 'Joined stream' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.leaveStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Transmetimi nuk u gjet' });

    if (stream.viewers > 0) {
      stream.viewers -= 1;
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
    res.json({ message: 'Left stream' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function generateStreamKey() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}