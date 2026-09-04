const Like = require('../models/Like');
const Post = require('../models/Post');
const User = require('../models/User');
const { notifyLike } = require('./notifications');
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
  const postId = parseInt(req.params.postId, 10);
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ msg: 'Invalid post id' });
  }

  try {
    const existingLike = await Like.findOne({ where: { userId: req.user.id, postId } });
    if (existingLike) {
      // Idempotent: nëse tashmë është pëlqyer, kthe sukses në vend të gabimit,
      // për të shmangur 400 errors nga double-click ose gjendje e pasinkronizuar në frontend.
      return res.json(existingLike);
    }

    // Only core columns — prod DB may not have migrated `emoji` yet.
    const like = await Like.create(
      { userId: req.user.id, postId },
      { fields: ['userId', 'postId'] }
    );

    try {
      const PostAnalytics = require('../models/PostAnalytics');
      await PostAnalytics.create({
        postId,
        userId: req.user.id,
        type: 'like',
      });
    } catch (analyticsErr) {
      console.warn('likePost: PostAnalytics skipped:', analyticsErr?.message || analyticsErr);
    }

    let post = null;
    try {
      const EngagementMetrics = require('../models/EngagementMetrics');
      post = await Post.findByPk(postId);
      if (post) {
        const today = new Date().toISOString().split('T')[0];
        let metrics = await EngagementMetrics.findOne({
          where: { userId: post.userId, date: today },
        });
        if (!metrics) {
          metrics = await EngagementMetrics.create({
            userId: post.userId,
            date: today,
          });
        }
        metrics.likesReceived = (metrics.likesReceived || 0) + 1;
        await metrics.save();
      }
    } catch (metricsErr) {
      console.warn('likePost: EngagementMetrics skipped:', metricsErr?.message || metricsErr);
    }

    try {
      if (!post) {
        post = await Post.findByPk(postId);
      }
      if (post && post.userId !== req.user.id) {
        await notifyLike(post.userId, req.user.id, postId);
        try {
          const liker = await User.findByPk(req.user.id);
          const postOwner = await User.findByPk(post.userId);
          if (liker && postOwner?.email) {
            const likerName = `${liker.firstName || ''} ${liker.lastName || ''}`.trim() || 'Someone';
            await sendEmail(postOwner.email, 'newLike', likerName, String(postId));
          }
        } catch (emailError) {
          console.warn('likePost: email skipped:', emailError?.message || emailError);
        }
      }
    } catch (notifyErr) {
      console.warn('likePost: notification skipped:', notifyErr?.message || notifyErr);
    }

    return res.json(like);
  } catch (err) {
    console.error('likePost error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

exports.unlikePost = async (req, res) => {
  const postId = parseInt(req.params.postId, 10);
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ msg: 'Invalid post id' });
  }

  try {
    const like = await Like.findOne({ where: { userId: req.user.id, postId } });
    if (!like) {
      // Idempotent: nëse tashmë s'ka like, konsideroje sukses (rezultati përfundimtar është i njëjtë).
      return res.json({ msg: 'Unliked' });
    }
    await like.destroy();
    return res.json({ msg: 'Unliked' });
  } catch (err) {
    console.error('unlikePost error:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
};
