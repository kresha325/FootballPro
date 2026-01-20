// Set sponsors for a post
exports.setPostSponsors = async (req, res) => {
  try {
    const { sponsorIds } = req.body; // expects array of sponsor IDs
    const { postId } = req.params;
    if (!Array.isArray(sponsorIds)) {
      return res.status(400).json({ msg: 'sponsorIds must be an array' });
    }
    const post = await Post.findOne({ where: { id: postId, userId: req.user.id } });
    if (!post) return res.status(404).json({ msg: 'Post not found or not owned by user' });
    // Set sponsors (replace all existing)
    await post.setSponsors(sponsorIds);
    const sponsors = await post.getSponsors();
    res.json({ sponsors: sponsors.map(s => s.toJSON()) });
  } catch (err) {
    console.error('Set post sponsors error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
const Post = require('../models/Post');
const Gallery = require('../models/Gallery');
// ...existing code...

exports.getPosts = async (req, res) => {
  try {
    const User = require('../models/User');
    const Profile = require('../models/Profile');
    const Like = require('../models/Like');
    const Comment = require('../models/Comment');
    
    const Sponsor = require('../models/Sponsor');
    const PostSponsor = require('../models/PostSponsor');
    const posts = await Post.findAll({ 
      include: [
        { model: User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'email'], include: [{ model: Profile, attributes: ['country', 'profilePhoto'] }] },
        { model: Sponsor, through: { attributes: [] } }
      ],
      order: [['createdAt', 'DESC']]
    });
    // Add like, comment counts, userLiked, and sponsors for each post
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const likesCount = await Like.count({ where: { postId: post.id } });
      const commentsCount = await Comment.count({ where: { postId: post.id } });
      const userLiked = req.user ? await Like.findOne({ 
        where: { postId: post.id, userId: req.user.id } 
      }) : null;
      // Get sponsors linked to this post
      const postSponsors = post.Sponsors || [];
      // Get all sponsors of the user
      const userSponsors = await Sponsor.findAll({ where: { userId: post.userId } });
      // Bashko pa duplikate
      const allSponsors = [
        ...postSponsors,
        ...userSponsors.filter(us => !postSponsors.some(ps => ps.id === us.id))
      ];
      // Standardizo path-in për imazhe dhe video të postimeve
      const postObj = post.toJSON();
      if (postObj.imageUrl) {
        const filename = postObj.imageUrl.split('/').pop();
        postObj.imageUrl = `/uploads/${filename}`;
      }
      if (postObj.videoUrl) {
        const filename = postObj.videoUrl.split('/').pop();
        postObj.videoUrl = `/uploads/${filename}`;
      }
      // Standardizo path-in e profilePhoto të author-it në çdo post
      if (postObj.author && postObj.author.Profile && postObj.author.Profile.profilePhoto) {
        const filename = postObj.author.Profile.profilePhoto.split('/').pop();
        postObj.author.profilePhoto = `/uploads/${filename}`;
      } else {
        postObj.author = postObj.author || {};
        postObj.author.profilePhoto = null;
      }
      return {
        ...postObj,
        likes: likesCount,
        comments: commentsCount,
        isLiked: !!userLiked,
        sponsors: allSponsors.map(s => s.toJSON ? s.toJSON() : s)
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
    
    const Sponsor = require('../models/Sponsor');
    const PostSponsor = require('../models/PostSponsor');
    const posts = await Post.findAll({ 
      where: { userId },
      include: [
        { model: User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'email'], include: [{ model: Profile, attributes: ['country', 'profilePhoto'] }] },
        { model: Sponsor, through: { attributes: [] } }
      ],
      order: [['createdAt', 'DESC']]
    });
    // Add like, comment counts, userLiked, and sponsors for each post
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const likesCount = await Like.count({ where: { postId: post.id } });
      const commentsCount = await Comment.count({ where: { postId: post.id } });
      const userLiked = req.user ? await Like.findOne({ 
        where: { postId: post.id, userId: req.user.id } 
      }) : null;
      // Get sponsors linked to this post
      const sponsors = post.Sponsors || [];
      // Standardizo path-in për imazhe dhe video të postimeve
      const postObj = post.toJSON();
      if (postObj.imageUrl) {
        const filename = postObj.imageUrl.split('/').pop();
        postObj.imageUrl = `/uploads/${filename}`;
      }
      if (postObj.videoUrl) {
        const filename = postObj.videoUrl.split('/').pop();
        postObj.videoUrl = `/uploads/${filename}`;
      }
      // Standardizo path-in e profilePhoto të author-it në çdo post
      if (postObj.author && postObj.author.Profile && postObj.author.Profile.profilePhoto) {
        const filename = postObj.author.Profile.profilePhoto.split('/').pop();
        postObj.author.profilePhoto = `/uploads/${filename}`;
      } else {
        postObj.author = postObj.author || {};
        postObj.author.profilePhoto = null;
      }
      return {
        ...postObj,
        likes: likesCount,
        comments: commentsCount,
        isLiked: !!userLiked,
        sponsors: sponsors.map(s => s.toJSON ? s.toJSON() : s)
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
    
    const { content, location, locationLat, locationLng, mentions } = req.body;
    let imageUrl = null;
    let videoUrl = null;
    // Merr path-in për imazh dhe video nga req.files
    if (req.files) {
      if (req.files['image'] && req.files['image'][0]) {
        imageUrl = `/uploads/${req.files['image'][0].filename}`;
      }
      if (req.files['video'] && req.files['video'][0]) {
        videoUrl = `/uploads/${req.files['video'][0].filename}`;
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
      locationLat: locationLat || null,
      locationLng: locationLng || null,
      mentions: mentionsParsed,
    });
    // Shto ne gallery nese ka image ose video
    if (imageUrl) {
      await Gallery.create({
        userId: req.user.id,
        imageUrl,
        type: 'photo',
        title: content ? content.substring(0, 100) : '',
      });
    } else if (videoUrl) {
      await Gallery.create({
        userId: req.user.id,
        videoUrl,
        type: 'video',
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