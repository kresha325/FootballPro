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
    const { assertVideoFile, assertDuration, rollbackUpload } = require('../utils/videoUpload');
    let publicId = null;
    let localPath = req.file?.path || null;
    try {
    if (req.file) assertVideoFile(req.file);
    let videoUrl = req.body.video || req.body.videoFile;
    const cloudinaryEnabled = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    if (!videoUrl && req.file) {
      if (cloudinaryEnabled) {
        const cloudRes = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'video',
          folder: 'videos',
        });
        videoUrl = cloudRes.secure_url;
        publicId = cloudRes.public_id;
        fs.unlink(req.file.path, () => {});
        localPath = null;
      } else {
        videoUrl = `/uploads/videos/${path.basename(req.file.path)}`;
      }
    }
    if (!videoUrl) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    const { title, description, category, tags, isPremium } = req.body;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      await rollbackUpload({ localPath, publicId, cloudinary });
      return res.status(400).json({ error: 'Title is required' });
    }
    if (req.body.playerId && Number(req.body.playerId) !== Number(req.user.id) && req.user.role !== 'admin') {
      await rollbackUpload({ localPath, publicId, cloudinary });
      return res.status(403).json({ error: 'You can only attach your own player profile' });
    }
    const duration = assertDuration(req.body.duration);
    const visibility = ['public', 'unlisted', 'private'].includes(req.body.visibility)
      ? req.body.visibility
      : 'public';
    const providerId = publicId || null;
    if (providerId) {
      const existing = await Video.findOne({ where: { provider: 'upload', providerId } });
      if (existing) {
        return res.status(409).json({ error: 'This video was already saved', video: existing });
      }
    }
    const video = await Video.create({
      userId: req.user.id,
      title: cleanTitle.slice(0, 255),
      description,
      videoUrl,
      publicId,
      thumbnailUrl: req.body.thumbnailUrl || null,
      duration: duration || 0,
      category,
      tags: tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
      isPremium: isPremium === 'true' || isPremium === true,
      isProcessing: false,
      processingStatus: 'completed',
      visibility,
      playerId: req.body.playerId
        ? parseInt(req.body.playerId, 10)
        : (req.user.role === 'athlete' ? req.user.id : null),
      matchId: req.body.matchId ? parseInt(req.body.matchId, 10) : null,
      tournamentId: req.body.tournamentId ? parseInt(req.body.tournamentId, 10) : null,
      season: req.body.season ? String(req.body.season).slice(0, 64) : null,
      featured: req.body.featured === 'true' || req.body.featured === true,
      provider: 'upload',
      providerId,
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
      await rollbackUpload({ localPath, publicId, cloudinary });
      console.error('Upload video error:', error);
      const status = error.statusCode || (error?.name === 'SequelizeUniqueConstraintError' ? 409 : 500);
      if (res.headersSent) return;
      res.status(status).json({
        error: error.statusCode ? error.message : (status === 409 ? 'This video was already saved' : error.message),
      });
    }
};

// Get all videos
exports.getVideos = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    const visibilityOr = [{ visibility: 'public' }, { visibility: null }];
    if (req.user?.id) visibilityOr.push({ userId: req.user.id });
    const whereClause = {
      processingStatus: 'completed',
      [Op.and]: [{ [Op.or]: visibilityOr }],
    };

    if (category) {
      whereClause.category = category;
    } else {
      whereClause[Op.and].push({
        [Op.or]: [
          { category: { [Op.ne]: 'live' } },
          { category: null },
          { category: '' },
        ],
      });
    }

    if (search) {
      whereClause[Op.and].push({
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    const videos = await Video.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 20)),
      offset: Math.max(0, parseInt(offset, 10) || 0),
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
          attributes: ['id', 'firstName', 'lastName', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position', 'club'] }],
        },
      ],
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    const visibility = video.visibility || 'public';
    const isOwner = req.user?.id && Number(video.userId) === Number(req.user.id);
    if (visibility === 'private' && !isOwner && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.isPremium && !req.user?.premium && !isOwner) {
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
    const video = await Video.findByPk(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (Number(video.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You cannot delete this video' });
    }

    if (video.publicId) {
      try {
        const cloudinary = require('../utils/cloudinary');
        await cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' });
      } catch (_err) {
        /* remote cleanup is best-effort */
      }
    }
    if (video.videoUrl && video.videoUrl.startsWith('/uploads/')) {
      const local = path.join(__dirname, '..', video.videoUrl.replace(/^\//, ''));
      if (fs.existsSync(local)) fs.unlinkSync(local);
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
          attributes: ['id', 'firstName', 'lastName', 'verified'],
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

    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (Number(video.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You cannot update this video' });
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
