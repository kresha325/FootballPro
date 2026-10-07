const logger = require('../utils/logger');

function jobsEnabled() {
  const raw = process.env.RUN_JOBS == null || String(process.env.RUN_JOBS).trim() === ''
    ? 'true'
    : String(process.env.RUN_JOBS);
  const flag = raw.trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

function startJobs() {
  if (!jobsEnabled()) return;

  const deleteExpiredAds = require('../utils/deleteExpiredAds');
  const { runTrackedJob } = require('../services/admin/jobs');
  setInterval(() => {
    runTrackedJob('ads_cleanup', deleteExpiredAds).catch((err) =>
      logger.warn('ads_cleanup:', err?.message || err)
    );
  }, 60 * 60 * 1000);
  const { purgeExpiredOutOfStockProducts } = require('../utils/productStock');
  purgeExpiredOutOfStockProducts().catch((err) =>
    logger.warn('purgeExpiredOutOfStockProducts startup:', err?.message || err)
  );
  setInterval(() => {
    runTrackedJob('product_stock_purge', purgeExpiredOutOfStockProducts).catch((err) =>
      logger.warn('purgeExpiredOutOfStockProducts:', err?.message || err)
    );
  }, 60 * 60 * 1000);
  const { purgeExpiredAnalyticsEvents } = require('../services/analytics/retention');
  setInterval(() => {
    runTrackedJob('analytics_retention', purgeExpiredAnalyticsEvents).catch((err) =>
      logger.warn('purgeExpiredAnalyticsEvents:', err?.message || err)
    );
  }, 6 * 60 * 60 * 1000);
  const { expireStaleLiveStreams, notifyStreamsStartingSoon } = require('../utils/streamLive');
  expireStaleLiveStreams()
    .then((n) => {
      if (n > 0) logger.info(`Expired ${n} stale live stream(s) on startup`);
    })
    .catch((err) => logger.warn('expireStaleLiveStreams startup:', err?.message || err));
  setInterval(() => {
    runTrackedJob('stream_expiry', () => expireStaleLiveStreams()).catch((err) =>
      logger.warn('expireStaleLiveStreams:', err?.message || err)
    );
    notifyStreamsStartingSoon().catch((err) => logger.warn('notifyStreamsStartingSoon:', err?.message || err));
  }, 5 * 60 * 1000);
}

module.exports = { startJobs, jobsEnabled };
