const Post = require('../models/Post');
const multer = require('multer');
const path = require('path');
const { Gallery } = require('../models');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/posts/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Accept all image and video types
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Only images and videos are allowed'));
  }
});

exports.upload = upload;

exports.getPosts = async (req, res) => {
  try {
    const User = require('../models/User');
    const Profile = require('../models/Profile');
    const Like = require('../models/Like');
    const Comment = require('../models/Comment');
    
    const posts = await Post.findAll({ 
      include: [{ 
        model: User, 
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{
          model: Profile,
          attributes: ['country', 'profilePhoto']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Add like and comment counts, and check if user liked each post
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const likesCount = await Like.count({ where: { postId: post.id } });
      const commentsCount = await Comment.count({ where: { postId: post.id } });
      const userLiked = req.user ? await Like.findOne({ 
        where: { postId: post.id, userId: req.user.id } 
      }) : null;
      
      return {
        ...post.toJSON(),
        likes: likesCount,
        comments: commentsCount,
        isLiked: !!userLiked
      };
    }));
    
    res.json(postsWithCounts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const User = require('../models/User');
    const Profile = require('../models/Profile');
    const Like = require('../models/Like');
    const Comment = require('../models/Comment');
    const { userId } = req.params;
    
    const posts = await Post.findAll({ 
      where: { userId },
      include: [{ 
        model: User, 
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{
          model: Profile,
          attributes: ['country', 'profilePhoto']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Add like and comment counts, and check if user liked each post
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const likesCount = await Like.count({ where: { postId: post.id } });
      const commentsCount = await Comment.count({ where: { postId: post.id } });
      const userLiked = req.user ? await Like.findOne({ 
        where: { postId: post.id, userId: req.user.id } 
      }) : null;
      
      return {
        ...post.toJSON(),
        likes: likesCount,
        comments: commentsCount,
        isLiked: !!userLiked
      };
    }));
    
    res.json(postsWithCounts);
  } catch (err) {
    console.error('Get user posts error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getPost = async (req, res) => {
  try {
    const User = require('../models/User');
    const post = await Post.findByPk(req.params.id, { 
      include: [{ 
        model: User, 
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email'] 
      }] 
    });
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    // Track view if not own post
    if (post.userId !== req.user.id) {
      const PostAnalytics = require('../models/PostAnalytics');
      await PostAnalytics.create({
        postId: post.id,
        userId: req.user.id,
        type: 'view',
      });

      // Update engagement metrics
      const EngagementMetrics = require('../models/EngagementMetrics');
      const today = new Date().toISOString().split('T')[0];
      let metrics = await EngagementMetrics.findOne({
        where: { userId: post.userId, date: today }
      });
      if (!metrics) {
        metrics = await EngagementMetrics.create({
          userId: post.userId,
          date: today,
        });
      }
      metrics.postViews += 1;
      await metrics.save();
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createPost = async (req, res) => {
  try {
    console.log('📝 CREATE POST - Body:', req.body);
    console.log('📁 CREATE POST - File:', req.file);
    
    const { content, location, mentions } = req.body;
    let imageUrl = null;
    let videoUrl = null;
    
    if (req.file) {
      const filePath = '/uploads/posts/' + req.file.filename;
      const isVideo = req.file.mimetype.startsWith('video/');
      
      if (isVideo) {
        videoUrl = filePath;
      } else {
        imageUrl = filePath;
      }
    }
    
    if (!content && !imageUrl && !videoUrl) {
      return res.status(400).json({ msg: 'Post must have content, image, or video' });
    }

    // Parse mentions if it's a string
    let mentionsParsed = [];
    if (mentions) {
      try {
        mentionsParsed = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
      } catch (e) {
        console.log('⚠️ Could not parse mentions:', e.message);
      }
    }
    
    const post = await Post.create({
      userId: req.user.id,
      content: content || '',
      imageUrl,
      videoUrl,
      location: location || null,
      mentions: mentionsParsed,
    });
    // Shto ne gallery nese ka image
    if (imageUrl) {
      await Gallery.create({
        userId: req.user.id,
        imageUrl,
        type: 'photo',
        title: content ? content.substring(0, 100) : '',
      });
    }

    console.log('✅ Post created:', post.id);

    // Create notifications for mentioned users
    if (mentionsParsed && mentionsParsed.length > 0) {
      const Notification = require('../models/Notification');
      const User = require('../models/User');
      const author = await User.findByPk(req.user.id);
      
      for (const userId of mentionsParsed) {
        try {
          await Notification.create({
            userId: userId,
            actorId: req.user.id,
            type: 'mention',
            title: 'You were mentioned',
            message: `${author.firstName} ${author.lastName} mentioned you in a post`,
            link: `/feed?post=${post.id}`
          });
        } catch (notifErr) {
          console.log('⚠️ Notification error for mention:', notifErr.message);
        }
      }
    }
    
      // Gamification u largua
    
    res.json(post);
  } catch (err) {
    console.error('❌ CREATE POST ERROR:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    await post.destroy();
    res.json({ msg: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};