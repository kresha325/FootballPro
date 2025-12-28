const ProfileView = require('../models/ProfileView');
const PostAnalytics = require('../models/PostAnalytics');
const EngagementMetrics = require('../models/EngagementMetrics');
const User = require('../models/User');
const Post = require('../models/Post');
const Profile = require('../models/Profile');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Subscription = require('../models/Subscription');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Track profile view
exports.trackProfileView = async (req, res) => {
  const { profileId } = req.params;
  try {
    // Don't track if user views their own profile
    if (req.user.id === parseInt(profileId)) {
      return res.json({ msg: 'Own profile view not tracked' });
    }

    await ProfileView.create({
      viewerId: req.user.id,
      profileId: parseInt(profileId),
    });

    // Update engagement metrics
    const today = new Date().toISOString().split('T')[0];
    let metrics = await EngagementMetrics.findOne({
      where: { userId: profileId, date: today }
    });
    if (!metrics) {
      metrics = await EngagementMetrics.create({
        userId: profileId,
        date: today,
      });
    }
    metrics.profileViews += 1;
    await metrics.save();

    res.json({ msg: 'Profile view tracked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Track post interaction
exports.trackPostInteraction = async (req, res) => {
  const { postId, type } = req.params;
  try {
    await PostAnalytics.create({
      postId: parseInt(postId),
      userId: req.user.id,
      type,
    });

    // Update engagement metrics for post owner
    const post = await Post.findByPk(postId);
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
      if (type === 'view') metrics.postViews += 1;
      else if (type === 'like') metrics.likesReceived += 1;
      else if (type === 'comment') metrics.commentsReceived += 1;
      else if (type === 'share') metrics.sharesReceived += 1;
      await metrics.save();
    }

    res.json({ msg: 'Interaction tracked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Profile views
    const profileViews = await ProfileView.count({
      where: {
        profileId: userId,
        viewedAt: { [Op.gte]: startDate }
      }
    });

    // Post analytics
    const posts = await Post.findAll({ where: { userId } });
    const postIds = posts.map(p => p.id);

    const postInteractions = await PostAnalytics.findAll({
      where: {
        postId: { [Op.in]: postIds },
        createdAt: { [Op.gte]: startDate }
      },
      attributes: [
        'type',
        [require('sequelize').fn('COUNT', require('sequelize').col('type')), 'count']
      ],
      group: ['type']
    });

    const engagement = {};
    postInteractions.forEach(item => {
      engagement[item.type] = parseInt(item.dataValues.count);
    });

    // Engagement metrics over time
    const metrics = await EngagementMetrics.findAll({
      where: {
        userId,
        date: { [Op.gte]: startDate }
      },
      order: [['date', 'ASC']]
    });

    // Follower growth - assuming there's a followers relationship
    // For now, placeholder
    const followersGained = 0; // TODO: implement followers

    res.json({
      profileViews,
      engagement,
      metrics,
      followersGained,
      postsCount: posts.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get post analytics
exports.getPostAnalytics = async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await Post.findOne({
      where: { id: postId, userId: req.user.id }
    });
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    const analytics = await PostAnalytics.findAll({
      where: { postId },
      attributes: [
        'type',
        [require('sequelize').fn('COUNT', require('sequelize').col('type')), 'count']
      ],
      group: ['type']
    });

    const result = {};
    analytics.forEach(item => {
      result[item.type] = parseInt(item.dataValues.count);
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get comprehensive dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const today = new Date().toISOString().split('T')[0];

    // Overview stats
    const totalPosts = await Post.count({ where: { userId } });
    const totalFollowers = await Subscription.count({ where: { subscribedToId: userId } });
    const totalFollowing = await Subscription.count({ where: { subscriberId: userId } });
    
    const totalLikes = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });
    
    const totalComments = await Comment.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });

    const profileViews = await ProfileView.count({
      where: {
        profileId: userId,
        viewedAt: { [Op.gte]: startDate },
      },
    });

    // Recent growth (last 7 days vs previous 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const previous14Days = new Date();
    previous14Days.setDate(previous14Days.getDate() - 14);

    const followersLast7 = await Subscription.count({
      where: { subscribedToId: userId, createdAt: { [Op.gte]: last7Days } },
    });
    const followersPrevious7 = await Subscription.count({
      where: {
        subscribedToId: userId,
        createdAt: { [Op.between]: [previous14Days, last7Days] },
      },
    });

    const likesLast7 = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
      where: { createdAt: { [Op.gte]: last7Days } },
    });
    const likesPrevious7 = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
      where: { createdAt: { [Op.between]: [previous14Days, last7Days] } },
    });

    // Engagement over time
    const engagementOverTime = await EngagementMetrics.findAll({
      where: {
        userId,
        date: { [Op.gte]: startDate },
      },
      order: [['date', 'ASC']],
    });

    // Top posts
    const topPosts = await Post.findAll({
      where: { userId },
      attributes: [
        'id',
        'content',
        'imageUrl',
        'createdAt',
        [sequelize.literal('(SELECT COUNT(*) FROM "Likes" WHERE "postId" = "Post"."id")'), 'likesCount'],
        [sequelize.literal('(SELECT COUNT(*) FROM "Comments" WHERE "postId" = "Post"."id")'), 'commentsCount'],
      ],
      order: [[sequelize.literal('likesCount'), 'DESC']],
      limit: 5,
    });

    // Engagement by post type (with/without image)
    const postsWithImage = await Post.count({
      where: { userId, imageUrl: { [Op.ne]: null } },
    });
    const postsWithoutImage = await Post.count({
      where: { userId, imageUrl: null },
    });

    const likesOnImagePosts = await Like.count({
      include: [
        {
          model: Post,
          where: { userId, imageUrl: { [Op.ne]: null } },
          attributes: [],
        },
      ],
    });
    const likesOnTextPosts = await Like.count({
      include: [
        {
          model: Post,
          where: { userId, imageUrl: null },
          attributes: [],
        },
      ],
    });

    // Activity by hour
    const postsByHour = await Post.findAll({
      where: { userId, createdAt: { [Op.gte]: startDate } },
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM "createdAt"')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM "createdAt"'))],
      order: [[sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM "createdAt"')), 'ASC']],
    });

    // Audience demographics (followers with profiles)
    const followersWithPosition = await User.findAll({
      include: [
        {
          model: Subscription,
          as: 'subscriptions',
          where: { subscribedToId: userId },
          attributes: [],
        },
        {
          model: Profile,
          attributes: ['position', 'city', 'country'],
        },
      ],
      attributes: ['id'],
    });

    const positionDistribution = {};
    const locationDistribution = {};
    followersWithPosition.forEach(follower => {
      if (follower.Profile?.position) {
        positionDistribution[follower.Profile.position] = 
          (positionDistribution[follower.Profile.position] || 0) + 1;
      }
      if (follower.Profile?.country) {
        locationDistribution[follower.Profile.country] = 
          (locationDistribution[follower.Profile.country] || 0) + 1;
      }
    });

    res.json({
      overview: {
        totalPosts,
        totalFollowers,
        totalFollowing,
        totalLikes,
        totalComments,
        profileViews,
        engagementRate: totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(2) : 0,
      },
      growth: {
        followers: {
          current: followersLast7,
          previous: followersPrevious7,
          change: followersPrevious7 > 0 
            ? (((followersLast7 - followersPrevious7) / followersPrevious7) * 100).toFixed(1)
            : 0,
        },
        likes: {
          current: likesLast7,
          previous: likesPrevious7,
          change: likesPrevious7 > 0
            ? (((likesLast7 - likesPrevious7) / likesPrevious7) * 100).toFixed(1)
            : 0,
        },
      },
      engagementOverTime,
      topPosts: topPosts.map(p => ({
        ...p.toJSON(),
        likesCount: parseInt(p.dataValues.likesCount) || 0,
        commentsCount: parseInt(p.dataValues.commentsCount) || 0,
      })),
      postTypePerformance: {
        withImage: {
          count: postsWithImage,
          avgLikes: postsWithImage > 0 ? (likesOnImagePosts / postsWithImage).toFixed(1) : 0,
        },
        withoutImage: {
          count: postsWithoutImage,
          avgLikes: postsWithoutImage > 0 ? (likesOnTextPosts / postsWithoutImage).toFixed(1) : 0,
        },
      },
      activityByHour: postsByHour.map(item => ({
        hour: parseInt(item.dataValues.hour),
        count: parseInt(item.dataValues.count),
      })),
      audience: {
        positions: positionDistribution,
        locations: locationDistribution,
      },
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get follower growth chart data
exports.getFollowerGrowth = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const subscriptions = await Subscription.findAll({
      where: {
        subscribedToId: userId,
        createdAt: { [Op.gte]: startDate },
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    });

    // Calculate cumulative count
    let cumulative = await Subscription.count({
      where: { subscribedToId: userId, createdAt: { [Op.lt]: startDate } },
    });

    const growthData = subscriptions.map(item => {
      cumulative += parseInt(item.dataValues.count);
      return {
        date: item.dataValues.date,
        count: cumulative,
      };
    });

    res.json(growthData);
  } catch (err) {
    console.error('Follower growth error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get engagement rate by day
exports.getEngagementRate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const posts = await Post.findAll({
      where: { userId, createdAt: { [Op.gte]: startDate } },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('Post.id')), 'postsCount'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
    });

    const postsByDate = {};
    posts.forEach(p => {
      postsByDate[p.dataValues.date] = parseInt(p.dataValues.postsCount);
    });

    const metrics = await EngagementMetrics.findAll({
      where: {
        userId,
        date: { [Op.gte]: startDate },
      },
      order: [['date', 'ASC']],
    });

    const engagementData = metrics.map(m => {
      const postsCount = postsByDate[m.date] || 1;
      return {
        date: m.date,
        rate: ((m.likesReceived + m.commentsReceived) / postsCount).toFixed(2),
        likes: m.likesReceived,
        comments: m.commentsReceived,
        views: m.postViews,
      };
    });

    res.json(engagementData);
  } catch (err) {
    console.error('Engagement rate error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};