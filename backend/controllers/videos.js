const Video = require('../models/Video');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Post = require('../models/Post');
const Gallery = require('../models/Gallery');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/videos/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

exports.upload = upload;

// Upload video
exports.uploadVideo = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  try {
    // Accept Cloudinary URL from middleware if present
    let videoUrl = req.body.video || req.body.videoFile;
    let publicId = null;
    if (!videoUrl && req.file) {
      // Fallback: upload to Cloudinary here if not handled by middleware
      const cloudRes = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'videos',
      });
      videoUrl = cloudRes.secure_url;
      publicId = cloudRes.public_id;
      // Fshi file lokal pas upload
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
    }
    if (!videoUrl) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    const { title, description, category, tags, isPremium } = req.body;
    const video = await Video.create({
      userId: req.user.id,
      title,
      description,
      videoUrl,
      publicId,
      category,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      isPremium: isPremium === 'true',
      isProcessing: false,
      processingStatus: 'completed',
    });

    // Also publish to feed so Videos upload appears in Lajmet / Feed
    const feedContent = [title, description].filter(Boolean).join('\n').trim() || 'Video e re';
    let feedPost = null;
    try {
      feedPost = await Post.create({
        userId: req.user.id,
        content: feedContent,
        videoUrl,
      });
      await Gallery.create({
        userId: req.user.id,
        videoUrl,
        type: 'video',
        title: (title || feedContent).substring(0, 100),
      });
      try {
        const io = req.app?.get?.('io');
        if (io && feedPost?.id) {
          io.emit('post:created', { id: feedPost.id });
        }
      } catch (_emitErr) {
        /* ignore socket errors */
      }
    } catch (feedErr) {
      console.warn('Video uploaded but feed post failed:', feedErr?.message || feedErr);
    }

    res.status(201).json({ ...video.toJSON(), postId: feedPost?.id || null });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all videos
exports.getVideos = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    const whereClause = { processingStatus: 'completed' };

    if (category) {
      whereClause.category = category;
    } else {
      whereClause[Op.or] = [
        { category: { [Op.ne]: 'live' } },
        { category: null },
        { category: '' },
      ];
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search] } },
      ];
    }

    const videos = await Video.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single video
exports.getVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club'] }],
        },
      ],
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check premium access
    if (video.isPremium && !req.user.premium) {
      return res.status(403).json({ error: 'Premium content requires subscription' });
    }

    // Increment views
    video.views += 1;
    await video.save();

    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user's videos
exports.getUserVideos = async (req, res) => {
  try {
    const { userId } = req.params;
    const videos = await Video.findAll({
      where: {
        userId,
        processingStatus: 'completed',
        [Op.or]: [
          { category: { [Op.ne]: 'live' } },
          { category: null },
          { category: '' },
        ],
      },
      order: [['createdAt', 'DESC']],
    });

    res.json(videos);
  } catch (error) {
    console.error('Get user videos error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Like video
exports.likeVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findByPk(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    video.likes += 1;
    await video.save();

    // Award XP to video owner
    if (video.userId !== req.user.id) {
      // Gamification u largua
    }

    res.json({ likes: video.likes });
  } catch (error) {
    console.error('Like video error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({
      where: { id, userId: req.user.id },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found or unauthorized' });
    }

    // Delete file from filesystem
    if (video.videoUrl && fs.existsSync(video.videoUrl.substring(1))) {
      fs.unlinkSync(video.videoUrl.substring(1));
    }

    await video.destroy();
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get trending videos
exports.getTrendingVideos = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const videos = await Video.findAll({
      where: {
        processingStatus: 'completed',
        [Op.or]: [
          { category: { [Op.ne]: 'live' } },
          { category: null },
          { category: '' },
        ],
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
      order: [
        ['views', 'DESC'],
        ['likes', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: parseInt(limit),
    });

    res.json(videos);
  } catch (error) {
    console.error('Get trending videos error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update video
exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags } = req.body;

    const video = await Video.findOne({
      where: { id, userId: req.user.id },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found or unauthorized' });
    }

    if (title) video.title = title;
    if (description) video.description = description;
    if (category) video.category = category;
    if (tags) video.tags = tags.split(',').map(t => t.trim());

    await video.save();
    res.json(video);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: error.message });
  }
};
