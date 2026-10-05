'use strict';

const { Op } = require('sequelize');
const { POST_VIEW_DEDUPE_MS } = require('./formulas');
const { invalidate } = require('./cache');

const TRACKED = new Set(['view', 'like', 'comment', 'share']);

/**
 * One post view per authenticated viewer per post inside 30 minutes.
 * A page render that repeats the request does not add another impression.
 * Like, comment, and share rows are idempotent per viewer+post+type so the
 * dedicated like/comment handlers and this endpoint cannot double-count.
 */
async function recordPostEvent({ postId, userId, type }) {
  const id = Number(postId);
  const actorId = Number(userId);
  const kind = String(type || '').toLowerCase();
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(actorId) || actorId <= 0) {
    return { counted: false, reason: 'invalid' };
  }
  if (!TRACKED.has(kind)) {
    const err = new Error('Interaction type must be view, like, comment, or share.');
    err.status = 400;
    throw err;
  }

  const Post = require('../../models/Post');
  const PostAnalytics = require('../../models/PostAnalytics');
  const post = await Post.findByPk(id, { attributes: ['id', 'userId'] });
  if (!post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }
  if (kind === 'view' && Number(post.userId) === actorId) {
    return { counted: false, reason: 'self' };
  }

  const since = new Date(Date.now() - (kind === 'view' ? POST_VIEW_DEDUPE_MS : 24 * 60 * 60 * 1000));
  const existing = await PostAnalytics.findOne({
    where: {
      postId: id,
      userId: actorId,
      type: kind,
      ...(kind === 'view' ? { createdAt: { [Op.gte]: since } } : {}),
    },
    attributes: ['id'],
  });
  if (existing) return { counted: false, reason: 'duplicate' };

  await PostAnalytics.create({ postId: id, userId: actorId, type: kind });
  await bumpOwnerMetric(post.userId, kind);
  invalidate(`social:${post.userId}:`);
  return { counted: true };
}

async function bumpOwnerMetric(ownerId, kind) {
  const field = {
    view: 'postViews',
    like: 'likesReceived',
    comment: 'commentsReceived',
    share: 'sharesReceived',
  }[kind];
  if (!field) return;
  const EngagementMetrics = require('../../models/EngagementMetrics');
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [metrics] = await EngagementMetrics.findOrCreate({
      where: { userId: ownerId, date: today },
      defaults: { userId: ownerId, date: today },
    });
    await metrics.increment(field);
  } catch (err) {
    if (!/unique|Validation/i.test(String(err?.message || err?.name || ''))) {
      console.warn('engagement metric bump:', err?.message || err);
    }
  }
}

module.exports = {
  recordPostEvent,
};
