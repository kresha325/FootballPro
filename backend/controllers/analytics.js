const db = require('../models');
const { Post } = db;
const { recordPostEvent } = require('../services/analytics/events');
const { userAnalytics, dashboard, followerSeries, engagementSeries } = require('../services/analytics/social');
const { clubAnalytics, assertClubAccess } = require('../services/analytics/club');
const { parseRange } = require('../services/analytics/formulas');

function sendError(res, err, label) {
  const status = err.status || 500;
  if (status >= 500) console.error(label || 'analytics', err);
  res.status(status).json({ msg: status >= 500 ? 'Server error' : err.message });
}

exports.getClubAnalytics = async (req, res) => {
  try {
    const clubId = Number(req.params.clubId);
    if (!Number.isFinite(clubId)) return res.status(400).json({ msg: 'Invalid club id.' });
    const allowed = await assertClubAccess(req.user, clubId);
    if (!allowed) return res.status(403).json({ msg: 'Club analytics are visible to the club and its staff.' });
    const data = await clubAnalytics(clubId, parseRange(req.query));
    res.json({
      totalAthletes: data.squadSize,
      pendingRequests: data.pendingRequests,
      shortlistCount: null,
      offersSent: null,
      offersAccepted: null,
      offersRejected: null,
      unavailable: {
        shortlistCount: 'Club shortlist is not a separate table. Scout shortlist is on /analytics/scouting.',
        offers: 'Transfer offers are not a ledger, so offer totals are omitted.',
      },
      ...data,
    });
  } catch (err) {
    sendError(res, err, 'getClubAnalytics');
  }
};

exports.trackProfileView = async (req, res) => {
  const { profileId } = req.params;
  try {
    const { recordProfileView } = require('../utils/profileViews');
    const result = await recordProfileView({
      viewerId: req.user.id,
      profileUserId: parseInt(profileId, 10),
    });
    if (!result.counted && result.reason === 'self') {
      return res.json({ msg: 'Own profile view not tracked' });
    }
    if (!result.counted && result.reason === 'duplicate') {
      return res.json({ msg: 'Profile view already counted' });
    }
    res.json({ msg: 'Profile view tracked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.trackPostInteraction = async (req, res) => {
  try {
    const result = await recordPostEvent({
      postId: req.params.postId,
      userId: req.user.id,
      type: req.params.type,
    });
    if (!result.counted && result.reason === 'self') return res.json({ msg: 'Own post view not tracked' });
    if (!result.counted && result.reason === 'duplicate') return res.json({ msg: 'Interaction already counted' });
    if (req.params.type === 'share' && result.counted) {
      const post = await Post.findByPk(req.params.postId, { attributes: ['id', 'userId'] });
      if (post && Number(post.userId) !== Number(req.user.id)) {
        try {
          const { notify } = require('../services/notifications/service');
          const User = require('../models/User');
          const actor = await User.findByPk(req.user.id, { attributes: ['firstName', 'lastName'] });
          const actorName = `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || 'Dikush';
          await notify({
            userId: post.userId,
            actorId: req.user.id,
            eventType: 'POST_SHARED',
            actorName,
            title: 'Shpërndarje',
            message: `${actorName} shpërndau postimin tuaj`,
            entityType: 'post',
            entityId: Number(req.params.postId),
            link: `/feed?post=${req.params.postId}`,
          });
        } catch (shareErr) {
          console.warn('share notification:', shareErr?.message || shareErr);
        }
      }
    }
    res.json({ msg: 'Interaction tracked' });
  } catch (err) {
    sendError(res, err, 'trackPostInteraction');
  }
};

exports.getUserAnalytics = async (req, res) => {
  try {
    const range = parseRange(req.query);
    res.json(await userAnalytics(req.user.id, range));
  } catch (err) {
    sendError(res, err, 'getUserAnalytics');
  }
};

exports.getPostAnalytics = async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await Post.findOne({ where: { id: postId, userId: req.user.id } });
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    const PostAnalytics = require('../models/PostAnalytics');
    const { Like, Comment } = require('../models');
    const [likes, comments, views, shares] = await Promise.all([
      Like.count({ where: { postId } }),
      Comment.count({ where: { postId } }),
      PostAnalytics.count({ where: { postId, type: 'view' } }),
      PostAnalytics.count({ where: { postId, type: 'share' } }),
    ]);
    const { engagementRate, ENGAGEMENT_RATE_FORMULA } = require('../services/analytics/formulas');
    const rate = engagementRate({ likes, comments, shares, impressions: views });
    res.json({
      view: views,
      like: likes,
      comment: comments,
      share: shares,
      engagementRate: rate.rate,
      engagementFormula: ENGAGEMENT_RATE_FORMULA,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const range = parseRange({ ...req.query, range: req.query.range || (req.query.period ? req.query.period : '30d') });
    res.json(await dashboard(req.user.id, range, req.user.id));
  } catch (err) {
    sendError(res, err, 'getDashboardAnalytics');
  }
};

exports.getFollowerGrowth = async (req, res) => {
  try {
    res.json(await followerSeries(req.user.id, parseRange(req.query)));
  } catch (err) {
    sendError(res, err, 'getFollowerGrowth');
  }
};

exports.getEngagementRate = async (req, res) => {
  try {
    res.json(await engagementSeries(req.user.id, parseRange(req.query)));
  } catch (err) {
    sendError(res, err, 'getEngagementRate');
  }
};
