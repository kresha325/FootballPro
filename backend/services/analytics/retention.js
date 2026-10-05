'use strict';

const { Op } = require('sequelize');
const {
  PROFILE_VIEW_RETENTION_DAYS,
  POST_EVENT_RETENTION_DAYS,
  MEDIA_EVENT_RETENTION_DAYS,
} = require('./formulas');

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Raw view events are deleted after the retention window.
 * Daily EngagementMetrics rows are kept, so lifetime profile-view totals
 * survive after the raw ProfileView rows are gone.
 * Unique viewers are only available inside the retention window.
 */
async function purgeExpiredAnalyticsEvents() {
  const ProfileView = require('../../models/ProfileView');
  const PostAnalytics = require('../../models/PostAnalytics');
  const MediaEvent = require('../../models/MediaEvent');
  const [profileViews, postEvents, mediaEvents] = await Promise.all([
    ProfileView.destroy({ where: { viewedAt: { [Op.lt]: daysAgo(PROFILE_VIEW_RETENTION_DAYS) } } }),
    PostAnalytics.destroy({ where: { createdAt: { [Op.lt]: daysAgo(POST_EVENT_RETENTION_DAYS) } } }),
    MediaEvent.destroy({ where: { createdAt: { [Op.lt]: daysAgo(MEDIA_EVENT_RETENTION_DAYS) } } }),
  ]);
  return { profileViews, postEvents, mediaEvents };
}

module.exports = {
  purgeExpiredAnalyticsEvents,
};
