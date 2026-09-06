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
    if (verified === 'true' || verified === 'false') {
      whereClause.verified = verified === 'true';
    }

    const users = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Profile,
          attributes: ['profilePhoto', 'position', 'club'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10) || 20,
      offset: ((parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 20),
      distinct: true,
    });

    const rows = users.rows.map((u) => {
      const json = u.toJSON();
      if (json.Profile) {
        // Back-compat for admin UI that historically read profilePicture
        json.Profile.profilePicture = json.Profile.profilePhoto || null;
      }
      return json;
    });

    res.json({
      users: rows,
      total: users.count,
      pages: Math.ceil(users.count / (parseInt(limit, 10) || 20)),
      currentPage: parseInt(page, 10) || 1,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
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
    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ msg: 'Nuk mund të fshish llogarinë tënde nga admin panel' });
    }
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    await user.destroy();
    res.json({ msg: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      msg: 'Server error',
      error: error?.message || 'Delete failed (FK constraints?)',
    });
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
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false,
          include: [
            {
              model: Profile,
              attributes: ['profilePhoto'],
              required: false,
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10) || 20,
      offset: ((parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 20),
      distinct: true,
    });

    const rows = posts.rows.map((p) => {
      const json = p.toJSON();
      // Admin UI expects `User` (not only `author`)
      const author = json.author || null;
      if (author?.Profile) {
        author.Profile.profilePicture = author.Profile.profilePhoto || null;
      }
      json.User = author;
      return json;
    });

    res.json({
      posts: rows,
      total: posts.count,
      pages: Math.ceil(posts.count / (parseInt(limit, 10) || 20)),
      currentPage: parseInt(page, 10) || 1,
    });
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
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

// Get analytics data (resilient: one failing query must not blank the whole dashboard)
exports.getAnalytics = async (req, res) => {
  const safe = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      console.warn(`getAnalytics.${label}:`, err?.message || err);
      return fallback;
    }
  };

  try {
    const Message = (() => {
      try {
        return require('../models/Message');
      } catch {
        return null;
      }
    })();
    const { JonCoinTransaction, LiveStream, Report, Block } = require('../models');

    const [
      userCount,
      postCount,
      commentCount,
      likeCount,
      matchCount,
      tournamentCount,
      subscriptionCount,
      orderCount,
      paymentCount,
      videoCount,
      streamCount,
      messageCount,
      liveStreamCount,
      joncoinTxCount,
      reportCount,
      blockCount,
    ] = await Promise.all([
      safe('users', () => User.count(), 0),
      safe('posts', () => Post.count(), 0),
      safe('comments', () => Comment.count(), 0),
      safe('likes', () => Like.count(), 0),
      safe('matches', () => Match.count(), 0),
      safe('tournaments', () => Tournament.count(), 0),
      safe('subscriptions', () => Subscription.count(), 0),
      safe('orders', () => Order.count(), 0),
      safe('payments', () => Payment.count(), 0),
      safe('videos', () => Video.count(), 0),
      safe('streams', () => Stream.count(), 0),
      safe('messages', () => (Message ? Message.count() : 0), 0),
      safe('liveStreams', () => (LiveStream ? LiveStream.count() : 0), 0),
      safe('joncoin', () => (JonCoinTransaction ? JonCoinTransaction.count() : 0), 0),
      safe('reports', () => (Report ? Report.count() : 0), 0),
      safe('blocks', () => (Block ? Block.count() : 0), 0),
    ]);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentUsers = await safe('recentUsers', () => User.count({ where: { createdAt: { [Op.gte]: last7Days } } }), 0);
    const recentPosts = await safe('recentPosts', () => Post.count({ where: { createdAt: { [Op.gte]: last7Days } } }), 0);
    const recentVideos = await safe('recentVideos', () => Video.count({ where: { createdAt: { [Op.gte]: last7Days } } }), 0);

    const activeUsers = await safe('activeUsers', async () => {
      const [rows] = await sequelize.query(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT DISTINCT "userId" AS uid FROM "Posts"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND "userId" IS NOT NULL
          UNION
          SELECT DISTINCT "userId" AS uid FROM "Comments"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND "userId" IS NOT NULL
        ) active
      `);
      return rows?.[0]?.count || 0;
    }, 0);

    const userRolesRaw = await safe(
      'userRoles',
      () =>
        User.findAll({
          attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['role'],
          raw: true,
        }),
      []
    );

    const monthlyUsersRaw = await safe(
      'monthlyUsers',
      () =>
        User.findAll({
          attributes: [
            [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'month'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          ],
          where: {
            createdAt: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '12 months'") },
          },
          group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt'))],
          order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'ASC']],
          raw: true,
        }),
      []
    );

    const dailyPostsRaw = await safe(
      'dailyPosts',
      () =>
        Post.findAll({
          attributes: [
            [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          ],
          where: {
            createdAt: { [Op.gte]: sequelize.literal("NOW() - INTERVAL '30 days'") },
          },
          group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
          order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
          raw: true,
        }),
      []
    );

    const topPostersRaw = await safe(
      'topPosters',
      () =>
        User.findAll({
          attributes: [
            'id',
            'firstName',
            'lastName',
            [sequelize.literal('(SELECT COUNT(*) FROM "Posts" WHERE "Posts"."userId" = "User"."id")'), 'postsCount'],
          ],
          order: [[sequelize.literal('"postsCount"'), 'DESC']],
          limit: 10,
          raw: true,
        }),
      []
    );

    const systemHealth = {
      activeStreams: await safe('activeStreams', () => Stream.count({ where: { isLive: true } }), 0),
      liveNow: await safe(
        'liveNow',
        () => (LiveStream ? LiveStream.count({ where: { isLive: true } }) : 0),
        0
      ),
      processingVideos: await safe('processingVideos', () => Video.count({ where: { isProcessing: true } }), 0),
      verifiedUsers: await safe('verifiedUsers', () => User.count({ where: { verified: true } }), 0),
      premiumUsers: await safe('premiumUsers', () => User.count({ where: { premium: true } }), 0),
      pendingReports: await safe(
        'pendingReports',
        () => (Report ? Report.count({ where: { status: 'pending' } }) : 0),
        0
      ),
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
        messages: messageCount,
        liveStreams: liveStreamCount,
        joncoinTransactions: joncoinTxCount,
        reports: reportCount,
        blocks: blockCount,
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts,
        videos: recentVideos,
        activeUsers,
      },
      userRoles: (userRolesRaw || []).map((r) => ({
        role: r.role,
        count: parseInt(r.count, 10) || 0,
      })),
      monthlyUsers: (monthlyUsersRaw || []).map((m) => ({
        month: m.month
          ? new Date(m.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          : '',
        count: parseInt(m.count, 10) || 0,
      })),
      dailyPosts: (dailyPostsRaw || []).map((d) => ({
        date: d.date ? String(d.date).slice(0, 10) : '',
        count: parseInt(d.count, 10) || 0,
      })),
      topPosters: (topPostersRaw || []).map((u) => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || `User #${u.id}`,
        posts: parseInt(u.postsCount, 10) || 0,
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

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ msg: 'Nuk mund të banosh veten' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.bannedAt = new Date();
    user.banReason = reason ? String(reason).slice(0, 1000) : 'Banned by admin';
    user.verified = false;
    if (duration) {
      user.banReason = `${user.banReason} (durationDays=${duration})`;
    }
    user.pushTokenMobile = null;
    user.pushTokenWeb = null;
    await user.save();

    res.json({ msg: 'User banned successfully', userId: user.id, bannedAt: user.bannedAt });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Unban user
exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.bannedAt = null;
    user.banReason = null;
    await user.save();

    res.json({ msg: 'User unbanned successfully', userId: user.id });
  } catch (error) {
    console.error('Unban user error:', error);
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

/** JonCoin: transaksione në pritje (blerje, tërheqje, shpenzime) për moderim admin. */
exports.getPendingJonCoinTransactions = async (req, res) => {
  try {
    const { JonCoinTransaction, User: UserModel } = require('../models');
    const transactions = await JonCoinTransaction.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: UserModel,
          attributes: ['id', 'email', 'firstName', 'lastName', 'joncoinBalance'],
        },
      ],
    });
    res.json({ transactions });
  } catch (error) {
    console.error('getPendingJonCoinTransactions:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

function buildInvoiceWhere(query = {}) {
  const { kind, source, search, from, to } = query;
  const where = {};
  if (kind) where.kind = kind;
  if (source) where.source = source;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }
  return { where, search: search ? String(search).trim() : '' };
}

/** List invoices for admin */
exports.listInvoices = async (req, res) => {
  try {
    const { Invoice } = require('../models');
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const { where, search } = buildInvoiceWhere(req.query);

    const and = [where];
    if (search) {
      and.push({
        [Op.or]: [
          { invoiceNumber: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { externalId: { [Op.iLike]: `%${search}%` } },
          { '$User.email$': { [Op.iLike]: `%${search}%` } },
          { '$User.firstName$': { [Op.iLike]: `%${search}%` } },
          { '$User.lastName$': { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    const result = await Invoice.findAndCountAll({
      where: { [Op.and]: and },
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'firstName', 'lastName'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
      subQuery: false,
    });

    res.json({
      invoices: result.rows,
      total: result.count,
      pages: Math.ceil(result.count / limit) || 1,
      currentPage: page,
    });
  } catch (error) {
    console.error('listInvoices:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const { Invoice } = require('../models');
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
    });
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    res.json({ invoice });
  } catch (error) {
    console.error('getInvoice:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

exports.exportInvoicesCsv = async (req, res) => {
  try {
    const { Invoice } = require('../models');
    const { where, search } = buildInvoiceWhere(req.query);

    const invoices = await Invoice.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: 5000,
    });

    let rows = invoices;
    if (search) {
      const q = search.toLowerCase();
      rows = invoices.filter((inv) => {
        const u = inv.User;
        const hay = [
          inv.invoiceNumber,
          inv.description,
          inv.externalId,
          u?.email,
          u?.firstName,
          u?.lastName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'invoiceNumber',
      'createdAt',
      'userId',
      'userEmail',
      'userName',
      'kind',
      'source',
      'status',
      'amount',
      'currency',
      'plan',
      'productId',
      'joncoinAmount',
      'externalId',
      'description',
    ];

    const lines = [header.join(',')];
    for (const inv of rows) {
      const u = inv.User;
      lines.push(
        [
          inv.invoiceNumber,
          inv.createdAt ? new Date(inv.createdAt).toISOString() : '',
          inv.userId,
          u?.email || '',
          `${u?.firstName || ''} ${u?.lastName || ''}`.trim(),
          inv.kind,
          inv.source,
          inv.status,
          inv.amount,
          inv.currency,
          inv.plan || '',
          inv.productId || '',
          inv.joncoinAmount || '',
          inv.externalId || '',
          inv.description || '',
        ]
          .map(esc)
          .join(',')
      );
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="xtalenti-invoices-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (error) {
    console.error('exportInvoicesCsv:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

