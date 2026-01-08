const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { sendNotification, notifyComment } = require('./notifications');
const { sendEmail } = require('../services/emailService');

exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.findAll({ where: { postId: req.params.postId }, include: [{ model: require('../models/User'), attributes: ['firstName', 'lastName'] }] });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createComment = async (req, res) => {
  const { content } = req.body;
  try {
    const comment = await Comment.create({
      userId: req.user.id,
      postId: req.params.postId,
      content,
    });

    // Track analytics
    const PostAnalytics = require('../models/PostAnalytics');
    await PostAnalytics.create({
      postId: parseInt(req.params.postId),
      userId: req.user.id,
      type: 'comment',
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
      metrics.commentsReceived += 1;
      await metrics.save();

      // Send notification and award XP to post owner
      if (post.userId !== req.user.id) {
        await notifyComment(post.userId, req.user.id, req.params.postId, content);
        
        // Send email notification
        try {
          const commenter = await User.findByPk(req.user.id);
          const postOwner = await User.findByPk(post.userId);
          const commenterName = `${commenter.firstName} ${commenter.lastName}`;
          const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          await sendEmail(postOwner.email, 'newComment', commenterName, preview, req.params.postId);
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }
        
        // Award points to post owner for receiving a comment
        // Gamification u largua
      }

      // Award points to commenter
      // Gamification u largua
    }

    res.json(comment);
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findOne({ 
      where: { 
        id: req.params.commentId, 
        userId: req.user.id 
      } 
    });
    if (!comment) return res.status(404).json({ msg: 'Comment not found or you do not have permission' });
    
    await comment.destroy();
    res.json({ msg: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};