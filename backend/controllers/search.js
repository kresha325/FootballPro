const Post = require('../models/Post');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Advanced search with filters
exports.searchUsers = async (req, res) => {
  const {
    q,
    position,
    club,
    city,
    country,
    minAge,
    maxAge,
    sortBy = 'relevance',
    page = 1,
    limit = 20,
  } = req.query;

  try {
    const offset = (page - 1) * limit;
    const whereUser = {};
    const whereProfile = {};

    // Text search
    if (q) {
      whereUser[Op.or] = [
        { firstName: { [Op.iLike]: `%${q}%` } },
        { lastName: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // Profile filters
    if (position) whereProfile.position = { [Op.iLike]: `%${position}%` };
    if (club) whereProfile.club = { [Op.iLike]: `%${club}%` };
    if (city) whereProfile.city = { [Op.iLike]: `%${city}%` };
    if (country) whereProfile.country = { [Op.iLike]: `%${country}%` };

    // Age filter
    if (minAge || maxAge) {
      const ageWhere = {};
      if (minAge) {
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() - parseInt(minAge));
        ageWhere[Op.lte] = maxDate;
      }
      if (maxAge) {
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - parseInt(maxAge));
        ageWhere[Op.gte] = minDate;
      }
      whereUser.dateOfBirth = ageWhere;
    }

    // Sorting
    let order = [];
    switch (sortBy) {
      case 'newest':
        order = [['createdAt', 'DESC']];
        break;
      case 'followers':
        order = [[sequelize.literal('(SELECT COUNT(*) FROM "Subscriptions" WHERE "followedId" = "User"."id")'), 'DESC']];
        break;
      case 'posts':
        order = [[sequelize.literal('(SELECT COUNT(*) FROM "Posts" WHERE "userId" = "User"."id")'), 'DESC']];
        break;
      default:
        order = [['firstName', 'ASC']];
    }

    const users = await User.findAndCountAll({
      where: whereUser,
      include: [
        {
          model: Profile,
          where: Object.keys(whereProfile).length > 0 ? whereProfile : undefined,
          required: Object.keys(whereProfile).length > 0,
          attributes: ['bio', 'position', 'club', 'city', 'country', 'profilePhoto'],
        },
      ],
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt'],
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      users: users.rows,
      total: users.count,
      page: parseInt(page),
      pages: Math.ceil(users.count / limit),
    });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.searchPosts = async (req, res) => {
  const {
    q,
    userId,
    minLikes,
    dateRange,
    sortBy = 'relevance',
    page = 1,
    limit = 20,
  } = req.query;

  try {
    const offset = (page - 1) * limit;
    const where = {};

    // Text search
    if (q) {
      where.content = { [Op.iLike]: `%${q}%` };
    }

    // User filter
    if (userId) {
      where.userId = userId;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const dateWhere = {};
      switch (dateRange) {
        case 'today':
          dateWhere[Op.gte] = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateWhere[Op.gte] = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateWhere[Op.gte] = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          dateWhere[Op.gte] = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }
      where.createdAt = dateWhere;
    }

    // Sorting
    let order = [];
    switch (sortBy) {
      case 'newest':
        order = [['createdAt', 'DESC']];
        break;
      case 'likes':
        order = [[sequelize.literal('(SELECT COUNT(*) FROM "Likes" WHERE "postId" = "Post"."id")'), 'DESC']];
        break;
      case 'comments':
        order = [[sequelize.literal('(SELECT COUNT(*) FROM "Comments" WHERE "postId" = "Post"."id")'), 'DESC']];
        break;
      default:
        order = [['createdAt', 'DESC']];
    }

    const posts = await Post.findAndCountAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [
            {
              model: Profile,
              attributes: ['profilePhoto', 'position'],
            },
          ],
        },
      ],
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Filter by min likes after fetching (requires Like count)
    let filteredPosts = posts.rows;
    if (minLikes) {
      const Like = require('../models/Like');
      const postsWithLikes = await Promise.all(
        filteredPosts.map(async (post) => {
          const likeCount = await Like.count({ where: { postId: post.id } });
          return { ...post.toJSON(), likeCount };
        })
      );
      filteredPosts = postsWithLikes.filter(p => p.likeCount >= parseInt(minLikes));
    }

    res.json({
      posts: filteredPosts,
      total: posts.count,
      page: parseInt(page),
      pages: Math.ceil(posts.count / limit),
    });
  } catch (err) {
    console.error('Search posts error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get trending posts (most liked/commented in last 7 days)
exports.getTrendingPosts = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await Post.findAll({
      where: {
        createdAt: {
          [Op.gte]: sevenDaysAgo,
        },
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [
            {
              model: Profile,
              attributes: ['profilePhoto', 'position'],
            },
          ],
        },
      ],
      limit: 10,
      order: [
        [sequelize.literal('(SELECT COUNT(*) FROM "Likes" WHERE "postId" = "Post"."id") + (SELECT COUNT(*) FROM "Comments" WHERE "postId" = "Post"."id")'), 'DESC'],
      ],
    });

    res.json(posts);
  } catch (err) {
    console.error('Get trending error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get trending users (most followed in last 30 days)
exports.getTrendingUsers = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const Subscription = require('../models/Subscription');
    
    const trendingUserIds = await Subscription.findAll({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
      attributes: [
        'followedId',
        [sequelize.fn('COUNT', sequelize.col('followedId')), 'followCount'],
      ],
      group: ['followedId'],
      order: [[sequelize.literal('followCount'), 'DESC']],
      limit: 10,
    });

    const userIds = trendingUserIds.map(u => u.followedId);

    const users = await User.findAll({
      where: {
        id: {
          [Op.in]: userIds,
        },
      },
      include: [
        {
          model: Profile,
          attributes: ['bio', 'position', 'club', 'profilePhoto'],
        },
      ],
      attributes: ['id', 'firstName', 'lastName'],
    });

    res.json(users);
  } catch (err) {
    console.error('Get trending users error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get recommended users based on shared interests
exports.getRecommendedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const Subscription = require('../models/Subscription');

    // Get user's profile
    const userProfile = await Profile.findOne({ where: { userId } });

    // Find users with similar position/club/city
    const where = {
      userId: {
        [Op.ne]: userId,
      },
    };

    if (userProfile) {
      const orConditions = [];
      if (userProfile.position) orConditions.push({ position: userProfile.position });
      if (userProfile.club) orConditions.push({ club: userProfile.club });
      if (userProfile.city) orConditions.push({ city: userProfile.city });

      if (orConditions.length > 0) {
        where[Op.or] = orConditions;
      }
    }

    // Get users current user is NOT following
    const followedUsers = await Subscription.findAll({
      where: { followerId: userId },
      attributes: ['followedId'],
    });
    const followedIds = followedUsers.map(f => f.followedId);

    if (followedIds.length > 0) {
      where.userId[Op.notIn] = followedIds;
    }

    const recommendedUsers = await User.findAll({
      include: [
        {
          model: Profile,
          where,
          required: true,
          attributes: ['bio', 'position', 'club', 'city', 'profilePhoto'],
        },
      ],
      attributes: ['id', 'firstName', 'lastName'],
      limit: 10,
    });

    res.json(recommendedUsers);
  } catch (err) {
    console.error('Get recommended users error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Autocomplete suggestions
exports.getSearchSuggestions = async (req, res) => {
  const { q, type = 'all' } = req.query;

  if (!q || q.length < 2) {
    return res.json({ users: [], positions: [], clubs: [] });
  }

  try {
    const suggestions = {};

    if (type === 'all' || type === 'users') {
      const users = await User.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.iLike]: `${q}%` } },
            { lastName: { [Op.iLike]: `${q}%` } },
          ],
        },
        attributes: ['id', 'firstName', 'lastName'],
        limit: 5,
      });
      suggestions.users = users;
    }

    if (type === 'all' || type === 'filters') {
      // Get unique positions
      const positions = await Profile.findAll({
        where: {
          position: {
            [Op.iLike]: `${q}%`,
            [Op.ne]: null,
          },
        },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('position')), 'position']],
        limit: 5,
      });
      suggestions.positions = positions.map(p => p.position).filter(Boolean);

      // Get unique clubs
      const clubs = await Profile.findAll({
        where: {
          club: {
            [Op.iLike]: `${q}%`,
            [Op.ne]: null,
          },
        },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('club')), 'club']],
        limit: 5,
      });
      suggestions.clubs = clubs.map(c => c.club).filter(Boolean);
    }

    res.json(suggestions);
  } catch (err) {
    console.error('Get suggestions error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};