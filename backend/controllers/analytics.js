const db = require('../models');
const { ProfileView, PostAnalytics, EngagementMetrics, User, Post, Profile, Like, Comment, Subscription } = db;
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const ClubMember = require('../models/ClubRosterRequest');
const ClubShortlist = require('../models/ClubShortlist');
const ClubOffer = require('../models/ClubOffer');

// Club analytics summary for club panel
exports.getClubAnalytics = async (req, res) => {
  try {
    const clubId = req.params.clubId;
    // Total approved athletes
    const totalAthletes = await ClubMember.count({ where: { clubId, status: 'approved' } });
    // Pending requests
    const pendingRequests = await ClubMember.count({ where: { clubId, status: 'pending' } });
    // Shortlist count
    const shortlistCount = await ClubShortlist.count({ where: { clubId } });
    // Offers sent
    const offersSent = await ClubOffer.count({ where: { clubId } });
    // Offers accepted
    const offersAccepted = await ClubOffer.count({ where: { clubId, status: 'accepted' } });
    // Offers rejected
    const offersRejected = await ClubOffer.count({ where: { clubId, status: 'rejected' } });
    res.json({
      totalAthletes,
      pendingRequests,
      shortlistCount,
      offersSent,
      offersAccepted,
      offersRejected,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    // LOGGING për debug (moved after variable declarations)
      const userId = req.user.id;

      // Statistikat kryesore
      const totalPosts = await Post.count({ where: { userId } });
      const totalFollowers = await Subscription.count({ where: { subscribedToId: userId } });
      const totalFollowing = await Subscription.count({ where: { subscriberId: userId } });

      // Merr id-të e postimeve të userit
      const userPosts = await Post.findAll({ where: { userId }, attributes: ['id'], raw: true });
      const userPostIds = userPosts.map(p => p.id);

      // Numëro pëlqimet dhe komentet për këto postime
      let totalLikes = 0;
      let totalComments = 0;
      if (userPostIds.length > 0) {
        totalLikes = await Like.count({ where: { postId: { [Op.in]: userPostIds } } });
        totalComments = await Comment.count({ where: { postId: { [Op.in]: userPostIds } } });
      }

      // Numëro shikimet e profilit
      const profileViews = await ProfileView.count({ where: { profileId: userId } });

      // LOGGING pas llogaritjeve
      console.log('DashboardAnalytics userId:', userId);
      console.log('userPostIds:', userPostIds);
      console.log('totalPosts:', totalPosts);
      console.log('totalLikes:', totalLikes);
      console.log('totalComments:', totalComments);
      console.log('profileViews:', profileViews);
  try {
    const userId = req.user.id;

    // Statistikat kryesore
    const totalPosts = await Post.count({ where: { userId } });
    const totalFollowers = await Subscription.count({ where: { subscribedToId: userId } });
    const totalFollowing = await Subscription.count({ where: { subscriberId: userId } });

    // Merr id-të e postimeve të userit
    const userPosts = await Post.findAll({ where: { userId }, attributes: ['id'], raw: true });
    const userPostIds = userPosts.map(p => p.id);

    // Numëro pëlqimet dhe komentet për këto postime
    let totalLikes = 0;
    let totalComments = 0;
    if (userPostIds.length > 0) {
      totalLikes = await Like.count({ where: { postId: { [Op.in]: userPostIds } } });
      totalComments = await Comment.count({ where: { postId: { [Op.in]: userPostIds } } });
    }

    // Numëro shikimet e profilit
    const profileViews = await ProfileView.count({ where: { profileId: userId } });

    // Top 5 postimet me të dhënat e plota të postit dhe autorit/profilit
    const topPostsRaw = await Post.findAll({
      where: { userId },
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM "Likes" WHERE "postId" = "Post"."id")'), 'likesCount'],
          [sequelize.literal('(SELECT COUNT(*) FROM "Comments" WHERE "postId" = "Post"."id")'), 'commentsCount'],
        ]
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'photo'],
          include: [
            {
              model: Profile,
              attributes: ['country', 'profilePhoto']
            }
          ]
        }
      ],
      order: [[sequelize.literal('"likesCount"'), 'DESC']],
      limit: 5
    });

    // Shto likesCount, commentsCount, isLiked (nëse ka user në req)
    const postsWithCounts = await Promise.all(topPostsRaw.map(async (post) => {
      let isLiked = false;
      if (req.user) {
        const userLiked = await Like.findOne({ where: { postId: post.id, userId: req.user.id } });
        isLiked = !!userLiked;
      }
      return {
        ...post.toJSON(),
        likesCount: parseInt(post.get('likesCount')) || 0,
        commentsCount: parseInt(post.get('commentsCount')) || 0,
        isLiked
      };
    }));

    // Performanca e postimeve me/pa foto
    const postsWithImage = await Post.count({ where: { userId, imageUrl: { [Op.ne]: null } } });
    const postsWithoutImage = await Post.count({ where: { userId, imageUrl: null } });
    let likesOnImagePosts = 0;
    let likesOnTextPosts = 0;
    if (userPostIds.length > 0) {
      const imagePostIds = (await Post.findAll({ where: { userId, imageUrl: { [Op.ne]: null } }, attributes: ['id'], raw: true })).map(p => p.id);
      const textPostIds = (await Post.findAll({ where: { userId, imageUrl: null }, attributes: ['id'], raw: true })).map(p => p.id);
      if (imagePostIds.length > 0) likesOnImagePosts = await Like.count({ where: { postId: { [Op.in]: imagePostIds } } });
      if (textPostIds.length > 0) likesOnTextPosts = await Like.count({ where: { postId: { [Op.in]: textPostIds } } });
    }

    // Përgjigja
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
      topPosts: postsWithCounts,
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