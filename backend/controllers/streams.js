// Fshin stream-in dhe videon e lidhur (nëse ka videoUrl)
exports.deleteStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    // Fshi file fizik nëse ka videoUrl
    if (stream.videoUrl) {
      const filePath = path.join(__dirname, '..', stream.videoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await stream.destroy();
    res.json({ message: 'Stream deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Pranon video të regjistruar nga frontend dhe e ruan në uploads/streams
const path = require('path');
const fs = require('fs');
exports.uploadRecording = async (req, res) => {
  try {
    console.log('[uploadRecording] req.user:', req.user);
    console.log('[uploadRecording] req.file:', req.file);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, description } = req.body;
    const streamerId = req.user.id;
    // Gjej stream-in ekzistues të tipit 'webrtc' për këtë user
    let stream = await Stream.findOne({ where: { streamerId, type: 'webrtc' } });
    if (stream) {
      stream.videoUrl = `/uploads/streams/${req.file.filename}`;
      stream.isLive = false;
      stream.type = 'recording';
      stream.title = title || stream.title;
      stream.description = description || stream.description;
      await stream.save();
      console.log('[uploadRecording] Stream updated:', stream.id, stream.videoUrl);
      res.json({ success: true, stream });
    } else {
      // Nëse nuk ka stream live, krijo të ri si më parë
      stream = await Stream.create({
        title: title || 'WebRTC Recording',
        description: description || '',
        streamerId,
        isPremium: false,
        isLive: false,
        type: 'recording',
        streamKey: null,
        videoUrl: `/uploads/streams/${req.file.filename}`,
      });
      console.log('[uploadRecording] Stream created:', stream.id, stream.videoUrl);
      res.json({ success: true, stream });
    }
  } catch (err) {
    console.error('[uploadRecording] ERROR:', err);
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
    } else {
      stream.isLive = true;
        stream.title = req.body.title || 'WebRTC Live';
        stream.description = req.body.description || '';
      await stream.save();
    }
    res.json({ message: 'WebRTC stream started', stream });
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

exports.createStream = async (req, res) => {
  try {
    const { title, description, isPremium } = req.body;
    const streamerId = req.user.id;

    const streamKey = generateStreamKey();

    const stream = await Stream.create({
      title,
      description,
      streamerId,
      isPremium: isPremium || false,
      streamKey,
    });

    res.status(201).json(stream);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStreams = async (req, res) => {
  try {
    const { isLive, limit = 20 } = req.query;
    const whereClause = {};

    if (isLive === 'true') {
      whereClause.isLive = true;
    }

    const streams = await Stream.findAll({
      where: whereClause,
      attributes: [
        'id', 'title', 'description', 'streamerId', 'isLive', 'viewers', 'isPremium', 'type', 'streamKey', 'videoUrl', 'createdAt', 'updatedAt'
      ],
      include: [
        {
          model: User,
          as: 'streamer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club'] }],
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
      if (s.isLive && s.streamKey) {
        s.hlsUrl = `/live/${s.streamKey}/index.m3u8`;
      }
      // Siguro që gjithmonë të kthehet një objekt streamer me photoUrl
      if (!s.streamer) {
        s.streamer = { firstName: 'Unknown', lastName: '', photoUrl: '/default-avatar.png' };
      } else if (s.streamer.Profile && s.streamer.Profile.profilePhoto) {
        s.streamer.photoUrl = s.streamer.Profile.profilePhoto.startsWith('/uploads/')
          ? `https://localhost:5098${s.streamer.Profile.profilePhoto}`
          : s.streamer.Profile.profilePhoto;
      } else {
        s.streamer.photoUrl = '/default-avatar.png';
      }
      return s;
    });
    res.json(streamsWithHls);
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id, {
      attributes: [
        'id', 'title', 'description', 'streamerId', 'isLive', 'viewers', 'isPremium', 'type', 'streamKey', 'videoUrl', 'createdAt', 'updatedAt'
      ],
      include: [
        {
          model: User,
          as: 'streamer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePicture', 'position', 'club'] }],
        },
      ],
    });
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    // Check if premium stream and user is not premium
    if (stream.isPremium && !req.user.premium) {
      return res.status(403).json({ error: 'Premium stream requires subscription' });
    }

    res.json(stream);
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
      return res.status(403).json({ error: 'Unauthorized' });
    }

    stream.isLive = true;
    await stream.save();

    // Award XP for starting a stream
    // Gamification u largua

    res.json({ message: 'Stream started', stream });
  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.endStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream || stream.streamerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    stream.isLive = false;
    await stream.save();
    res.json({ message: 'Stream ended' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.joinStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    if (stream.isPremium && !req.user.premium) {
      return res.status(403).json({ error: 'Premium stream requires subscription' });
    }

    stream.viewers += 1;
    await stream.save();
    res.json({ message: 'Joined stream' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.leaveStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    if (stream.viewers > 0) {
      stream.viewers -= 1;
      await stream.save();
    }
    res.json({ message: 'Left stream' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function generateStreamKey() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}