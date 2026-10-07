'use strict';

const logger = require('./logger');

const { Op } = require('sequelize');

const VIEW_DEDUPE_MS = 6 * 60 * 60 * 1000;

/**
 * Count one profile view per authenticated viewer inside a 6-hour window.
 * Own views and anonymous requests are ignored so a render loop cannot inflate the counter.
 */
async function recordProfileView({ viewerId, profileUserId }) {
  const viewer = Number(viewerId);
  const profileId = Number(profileUserId);
  if (!Number.isFinite(viewer) || viewer <= 0 || !Number.isFinite(profileId) || profileId <= 0) {
    return { counted: false, reason: 'anonymous' };
  }
  if (viewer === profileId) return { counted: false, reason: 'self' };

  const ProfileView = require('../models/ProfileView');
  const since = new Date(Date.now() - VIEW_DEDUPE_MS);
  const existing = await ProfileView.findOne({
    where: {
      viewerId: viewer,
      profileId,
      viewedAt: { [Op.gte]: since },
    },
    attributes: ['id'],
  });
  if (existing) return { counted: false, reason: 'duplicate' };

  await ProfileView.create({
    viewerId: viewer,
    profileId,
    viewedAt: new Date(),
  });

  try {
    const { notifyProfileViewed } = require('../services/notifications/events');
    await notifyProfileViewed({ viewerId: viewer, profileUserId: profileId });
  } catch (err) {
    logger.warn('profile view notification:', err?.message || err);
  }

  try {
    const EngagementMetrics = require('../models/EngagementMetrics');
    const today = new Date().toISOString().split('T')[0];
    let metrics = await EngagementMetrics.findOne({ where: { userId: profileId, date: today } });
    if (!metrics) {
      metrics = await EngagementMetrics.create({ userId: profileId, date: today });
    }
    metrics.profileViews = (Number(metrics.profileViews) || 0) + 1;
    await metrics.save();
  } catch (err) {
    logger.warn('profile view metrics:', err?.message || err);
  }

  return { counted: true };
}

module.exports = {
  VIEW_DEDUPE_MS,
  recordProfileView,
};
