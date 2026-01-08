const Like = require('../models/Like');
const Post = require('../models/Post');
const User = require('../models/User');
const { sendNotification, notifyLike } = require('./notifications');
const { sendEmail } = require('../services/emailService');

exports.getLikes = async (req, res) => {
  try {
    const likes = await Like.findAll({ where: { postId: req.params.postId } });
    res.json(likes);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.likePost = async (req, res) => {
  try {
    const existingLike = await Like.findOne({ where: { userId: req.user.id, postId: req.params.postId } });
    if (existingLike) return res.status(400).json({ msg: 'Already liked' });
    const like = await Like.create({
      userId: req.user.id,
      postId: req.params.postId,
    });

    // Track analytics
    const PostAnalytics = require('../models/PostAnalytics');
    await PostAnalytics.create({
      postId: parseInt(req.params.postId),
      userId: req.user.id,
      type: 'like',
    });

    // Update engagement metrics
    const EngagementMetrics = require('../models/EngagementMetrics');
    const post = await Post.findByPk(req.params.postId);
    if (post) {
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
      metrics.likesReceived += 1;
      await metrics.save();
    }

    // Send notification to post owner
    if (post && post.userId !== req.user.id) {
      await notifyLike(post.userId, req.user.id, req.params.postId);
      
      // Send email notification
      try {
        const liker = await User.findByPk(req.user.id);
        const postOwner = await User.findByPk(post.userId);
        const likerName = `${liker.firstName} ${liker.lastName}`;
        await sendEmail(postOwner.email, 'newLike', likerName, req.params.postId);
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }
      
      // Award points to post owner for receiving a like
      // Gamification u largua
    }
    res.json(like);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const like = await Like.findOne({ where: { userId: req.user.id, postId: req.params.postId } });
    if (!like) return res.status(404).json({ msg: 'Like not found' });
    await like.destroy();
    res.json({ msg: 'Unliked' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};