const Stream = require('../models/Stream');
const User = require('../models/User');
const Profile = require('../models/Profile');
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
      include: [
        {
          model: User,
          as: 'streamer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePicture', 'position', 'club'] }],
        },
      ],
      order: [
        ['isLive', 'DESC'],
        ['viewers', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: parseInt(limit),
    });
    res.json(streams);
  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStream = async (req, res) => {
  try {
    const { id } = req.params;
    const stream = await Stream.findByPk(id, {
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
    const gamificationController = require('./gamification');
    await gamificationController.awardPoints(req.user.id, 15, 'Started a live stream');

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