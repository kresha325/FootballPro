'use strict';

const { Op } = require('sequelize');
const {
  engagementRate,
  interactionsPerPost,
  createdBetween,
  PROFILE_VIEW_RETENTION_DAYS,
  ENGAGEMENT_RATE_FORMULA,
} = require('./formulas');
const { remember, TTL } = require('./cache');

function rangeKey(range) {
  return `${range?.key || '30d'}:${range?.from ? new Date(range.from).toISOString() : ''}:${range?.to ? new Date(range.to).toISOString() : ''}`;
}

async function countOwned(Model, ownerId, extraWhere, range, dateField = 'createdAt') {
  const where = { ...(extraWhere || {}) };
  const between = createdBetween(range);
  if (between) where[dateField] = between;
  const Post = require('../../models/Post');
  return Model.count({
    where,
    include: [{ model: Post, attributes: [], where: { userId: ownerId }, required: true }],
  });
}

async function socialTotals(userId, range) {
  const { Post, Like, Comment, Follow, ProfileView, PostAnalytics, EngagementMetrics } = require('../../models');
  const between = createdBetween(range);
  const postWhere = { userId };
  const followWhere = { followingId: userId, status: 'accepted' };
  const profileWhere = { profileId: userId };
  if (between) {
    profileWhere.viewedAt = between;
  }

  const [totalPosts, postsInPeriod, followers, following, followersGained, profileViews, uniqueViewers, lifetimeProfileViews, likes, comments, shares, impressions] =
    await Promise.all([
      Post.count({ where: { userId } }),
      Post.count({ where: between ? { userId, createdAt: between } : { userId } }),
      Follow.count({ where: followWhere }),
      Follow.count({ where: { followerId: userId, status: 'accepted' } }),
      between ? Follow.count({ where: { ...followWhere, createdAt: between } }) : Follow.count({ where: followWhere }),
      ProfileView.count({ where: profileWhere }),
      ProfileView.count({ where: profileWhere, distinct: true, col: 'viewerId' }),
      EngagementMetrics.sum('profileViews', { where: { userId } }),
      countOwned(Like, userId, {}, range),
      countOwned(Comment, userId, {}, range),
      countOwned(PostAnalytics, userId, { type: 'share' }, range),
      countOwned(PostAnalytics, userId, { type: 'view' }, range),
    ]);

  const rate = engagementRate({ likes, comments, shares, impressions });
  return {
    cumulative: {
      posts: totalPosts,
      followers,
      following,
      profileViews: Number(lifetimeProfileViews) || 0,
      profileViewsNote: `Lifetime total is the sum of daily counters. Unique viewers are kept for ${PROFILE_VIEW_RETENTION_DAYS} days.`,
    },
    period: {
      label: range?.label || null,
      posts: postsInPeriod,
      followersGained: between ? followersGained : null,
      followersGainedNote: between ? null : 'Follower total is cumulative. Growth is only calculated for a dated range.',
      profileViews,
      uniqueViewers,
      likes,
      comments,
      shares,
      impressions,
      engagementRate: rate.rate,
      engagementBasis: rate.basis,
      engagementFormula: ENGAGEMENT_RATE_FORMULA,
      engagementSufficient: rate.sufficient,
      interactionsPerPost: interactionsPerPost({ likes, comments, shares, posts: postsInPeriod }),
    },
  };
}

async function followerSeries(userId, range) {
  const sequelize = require('../../config/database');
  const { QueryTypes } = require('sequelize');
  if (!range?.from) return [];
  const rows = await sequelize.query(
    `SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
     FROM "Follows"
     WHERE "followingId" = :userId AND status = 'accepted' AND "createdAt" >= :from AND "createdAt" <= :to
     GROUP BY DATE("createdAt")
     ORDER BY DATE("createdAt") ASC`,
    { replacements: { userId, from: range.from, to: range.to || new Date() }, type: QueryTypes.SELECT }
  );
  const before = await require('../../models').Follow.count({
    where: {
      followingId: userId,
      status: 'accepted',
      createdAt: { [Op.lt]: range.from },
    },
  });
  let cumulative = before;
  return rows.map((row) => {
    cumulative += Number(row.count) || 0;
    return { date: row.date, gained: Number(row.count) || 0, count: cumulative };
  });
}

async function engagementSeries(userId, range) {
  const sequelize = require('../../config/database');
  const { QueryTypes } = require('sequelize');
  if (!range?.from) return [];
  const rows = await sequelize.query(
    `SELECT day,
            SUM(likes)::int AS likes,
            SUM(comments)::int AS comments,
            SUM(shares)::int AS shares,
            SUM(views)::int AS views
     FROM (
       SELECT DATE(l."createdAt") AS day, COUNT(*)::int AS likes, 0 AS comments, 0 AS shares, 0 AS views
       FROM "Likes" l INNER JOIN "Posts" p ON p.id = l."postId"
       WHERE p."userId" = :userId AND l."createdAt" >= :from AND l."createdAt" <= :to
       GROUP BY DATE(l."createdAt")
       UNION ALL
       SELECT DATE(c."createdAt") AS day, 0, COUNT(*)::int, 0, 0
       FROM "Comments" c INNER JOIN "Posts" p ON p.id = c."postId"
       WHERE p."userId" = :userId AND c."createdAt" >= :from AND c."createdAt" <= :to
       GROUP BY DATE(c."createdAt")
       UNION ALL
       SELECT DATE(a."createdAt") AS day, 0, 0,
              SUM(CASE WHEN a.type = 'share' THEN 1 ELSE 0 END)::int,
              SUM(CASE WHEN a.type = 'view' THEN 1 ELSE 0 END)::int
       FROM "PostAnalytics" a INNER JOIN "Posts" p ON p.id = a."postId"
       WHERE p."userId" = :userId AND a."createdAt" >= :from AND a."createdAt" <= :to
       GROUP BY DATE(a."createdAt")
     ) days
     GROUP BY day
     ORDER BY day ASC`,
    { replacements: { userId, from: range.from, to: range.to || new Date() }, type: QueryTypes.SELECT }
  );
  return rows.map((row) => {
    const rate = engagementRate({
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      impressions: row.views,
    });
    return {
      date: row.day,
      rate: rate.rate,
      likes: Number(row.likes) || 0,
      comments: Number(row.comments) || 0,
      shares: Number(row.shares) || 0,
      views: Number(row.views) || 0,
    };
  });
}

async function topPosts(userId, viewerId) {
  const sequelize = require('../../config/database');
  const { Post, User, Profile, Like } = require('../../models');
  const rows = await Post.findAll({
    where: { userId },
    attributes: {
      include: [
        [sequelize.literal('(SELECT COUNT(*) FROM "Likes" WHERE "postId" = "Post"."id")'), 'likesCount'],
        [sequelize.literal('(SELECT COUNT(*) FROM "Comments" WHERE "postId" = "Post"."id")'), 'commentsCount'],
      ],
    },
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, attributes: ['country', 'profilePhoto'] }],
      },
    ],
    order: [[sequelize.literal('"likesCount"'), 'DESC']],
    limit: 5,
  });
  const ids = rows.map((row) => row.id);
  const liked = ids.length
    ? await Like.findAll({
        where: { userId: viewerId, postId: { [Op.in]: ids } },
        attributes: ['postId'],
        raw: true,
      })
    : [];
  const likedSet = new Set(liked.map((row) => Number(row.postId)));
  return rows.map((post) => ({
    ...post.toJSON(),
    likesCount: parseInt(post.get('likesCount'), 10) || 0,
    commentsCount: parseInt(post.get('commentsCount'), 10) || 0,
    isLiked: likedSet.has(Number(post.id)),
  }));
}

async function postTypePerformance(userId) {
  const { Post, Like } = require('../../models');
  const [withImage, withoutImage] = await Promise.all([
    Post.findAll({ where: { userId, imageUrl: { [Op.ne]: null } }, attributes: ['id'], raw: true }),
    Post.findAll({ where: { userId, imageUrl: null }, attributes: ['id'], raw: true }),
  ]);
  const imageIds = withImage.map((row) => row.id);
  const textIds = withoutImage.map((row) => row.id);
  const [imageLikes, textLikes] = await Promise.all([
    imageIds.length ? Like.count({ where: { postId: { [Op.in]: imageIds } } }) : 0,
    textIds.length ? Like.count({ where: { postId: { [Op.in]: textIds } } }) : 0,
  ]);
  return {
    withImage: {
      count: imageIds.length,
      avgLikes: imageIds.length ? (imageLikes / imageIds.length).toFixed(1) : 0,
    },
    withoutImage: {
      count: textIds.length,
      avgLikes: textIds.length ? (textLikes / textIds.length).toFixed(1) : 0,
    },
  };
}

async function dashboard(userId, range, viewerId) {
  return remember(`social:${userId}:${rangeKey(range)}`, TTL.social, async () => {
    const totals = await socialTotals(userId, range);
    const period = totals.period;
    const [posts, types] = await Promise.all([topPosts(userId, viewerId || userId), postTypePerformance(userId)]);
    return {
      overview: {
        totalPosts: totals.cumulative.posts,
        totalFollowers: totals.cumulative.followers,
        totalFollowing: totals.cumulative.following,
        totalLikes: period.likes,
        totalComments: period.comments,
        totalShares: period.shares,
        profileViews: period.profileViews,
        uniqueViewers: period.uniqueViewers,
        lifetimeProfileViews: totals.cumulative.profileViews,
        impressions: period.impressions,
        engagementRate: period.engagementRate,
        engagementBasis: period.engagementBasis,
        engagementFormula: period.engagementFormula,
        interactionsPerPost: period.interactionsPerPost,
        period: range?.key || null,
        periodLabel: range?.label || null,
      },
      topPosts: posts,
      postTypePerformance: types,
      formula: ENGAGEMENT_RATE_FORMULA,
    };
  });
}

async function userAnalytics(userId, range) {
  const totals = await socialTotals(userId, range);
  return {
    profileViews: totals.period.profileViews,
    uniqueViewers: totals.period.uniqueViewers,
    lifetimeProfileViews: totals.cumulative.profileViews,
    followersGained: totals.period.followersGained,
    postsCount: totals.cumulative.posts,
    engagement: {
      view: totals.period.impressions,
      like: totals.period.likes,
      comment: totals.period.comments,
      share: totals.period.shares,
    },
    engagementRate: totals.period.engagementRate,
    engagementFormula: ENGAGEMENT_RATE_FORMULA,
    retentionDays: PROFILE_VIEW_RETENTION_DAYS,
  };
}

module.exports = {
  socialTotals,
  followerSeries,
  engagementSeries,
  dashboard,
  userAnalytics,
};
