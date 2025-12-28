const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Profile = require('../models/Profile');
const Video = require('../models/Video');
const Stream = require('../models/Stream');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, verified, page = 1, limit = 20 } = req.query;
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) whereClause.role = role;
    if (verified !== undefined) whereClause.verified = verified === 'true';

    const users = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [{ model: Profile, attributes: ['profilePicture', 'position', 'club'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      users: users.rows,
      total: users.count,
      pages: Math.ceil(users.count / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    user.role = role;
    await user.save();
    
    res.json({ msg: 'User role updated', user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    await user.destroy();
    res.json({ msg: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get all posts
exports.getAllPosts = async (req, res) => {
  try {
    const { search, userId, page = 1, limit = 20 } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.content = { [Op.iLike]: `%${search}%` };
    }

    if (userId) whereClause.userId = userId;

    const posts = await Post.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{ model: Profile, attributes: ['profilePicture'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      posts: posts.rows,
      total: posts.count,
      pages: Math.ceil(posts.count / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    await post.destroy();
    res.json({ msg: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get analytics data
exports.getAnalytics = async (req, res) => {
  try {
    // Total counts
    const userCount = await User.count();
    const postCount = await Post.count();
    const commentCount = await Comment.count();
    const likeCount = await Like.count();
    const matchCount = await Match.count();
    const tournamentCount = await Tournament.count();
    const subscriptionCount = await Subscription.count();
    const orderCount = await Order.count();
    const paymentCount = await Payment.count();
    const videoCount = await Video.count();
    const streamCount = await Stream.count();

    // Recent activity (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentUsers = await User.count({
      where: { createdAt: { [Op.gte]: last7Days } },
    });
    const recentPosts = await Post.count({
      where: { createdAt: { [Op.gte]: last7Days } },
    });
    const recentVideos = await Video.count({
      where: { createdAt: { [Op.gte]: last7Days } },
    });

    // Active users (posted/commented/liked in last 7 days)
    const activeUsers = await User.count({
      where: {
        [Op.or]: [
          {
            id: {
              [Op.in]: sequelize.literal(
                `(SELECT DISTINCT "userId" FROM "Posts" WHERE "createdAt" >= NOW() - INTERVAL '7 days')`
              ),
            },
          },
          {
            id: {
              [Op.in]: sequelize.literal(
                `(SELECT DISTINCT "userId" FROM "Comments" WHERE "createdAt" >= NOW() - INTERVAL '7 days')`
              ),
            },
          },
        ],
      },
    });

    // User role distribution
    const userRoles = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['role'],
      raw: true,
    });

    // Monthly user registrations (last 12 months)
    const monthlyUsers = await User.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: {
        createdAt: {
          [Op.gte]: sequelize.literal("NOW() - INTERVAL '12 months'"),
        },
      },
      group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    // Daily posts (last 30 days)
    const dailyPosts = await Post.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: {
        createdAt: {
          [Op.gte]: sequelize.literal("NOW() - INTERVAL '30 days'"),
        },
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    // Top users by posts
    const topPosters = await User.findAll({
      attributes: [
        'id',
        'firstName',
        'lastName',
        [sequelize.literal('(SELECT COUNT(*) FROM "Posts" WHERE "Posts"."userId" = "User"."id")'), 'postsCount'],
      ],
      order: [[sequelize.literal('postsCount'), 'DESC']],
      limit: 10,
      raw: true,
    });

    // System health
    const systemHealth = {
      activeStreams: await Stream.count({ where: { isLive: true } }),
      processingVideos: await Video.count({ where: { isProcessing: true } }),
      verifiedUsers: await User.count({ where: { verified: true } }),
      premiumUsers: await User.count({ where: { premium: true } }),
    };

    res.json({
      totals: {
        users: userCount,
        posts: postCount,
        comments: commentCount,
        likes: likeCount,
        matches: matchCount,
        tournaments: tournamentCount,
        subscriptions: subscriptionCount,
        orders: orderCount,
        payments: paymentCount,
        videos: videoCount,
        streams: streamCount,
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts,
        videos: recentVideos,
        activeUsers,
      },
      userRoles,
      monthlyUsers: monthlyUsers.map(m => ({
        month: new Date(m.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        count: parseInt(m.count),
      })),
      dailyPosts: dailyPosts.map(d => ({
        date: d.date,
        count: parseInt(d.count),
      })),
      topPosters: topPosters.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        posts: parseInt(u.postsCount),
      })),
      systemHealth,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

// Ban user
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.verified = false;
    await user.save();

    res.json({ msg: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Verify user
exports.verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.verified = true;
    await user.save();

    res.json({ msg: 'User verified successfully', user });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Toggle premium
exports.togglePremium = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.premium = !user.premium;
    await user.save();

    res.json({ msg: `Premium ${user.premium ? 'enabled' : 'disabled'}`, user });
  } catch (error) {
    console.error('Toggle premium error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Reset user password (admin only)
exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({ 
      msg: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

