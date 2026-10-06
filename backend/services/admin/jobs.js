'use strict';

const { sanitizeMessage } = require('./errors');

const INTERVALS = {
  ads_cleanup: 60 * 60 * 1000,
  product_stock_purge: 60 * 60 * 1000,
  analytics_retention: 6 * 60 * 60 * 1000,
  stream_expiry: 5 * 60 * 1000,
  notification_reminders: 10 * 60 * 1000,
};

const RETRYABLE = new Set(Object.keys(INTERVALS));
const latest = new Map();

function jobHandlers() {
  return {
    ads_cleanup: () => require('../../utils/deleteExpiredAds')(),
    product_stock_purge: () => require('../../utils/productStock').purgeExpiredOutOfStockProducts(),
    analytics_retention: () => require('../analytics/retention').purgeExpiredAnalyticsEvents(),
    stream_expiry: () => require('../../utils/streamLive').expireStaleLiveStreams(),
    notification_reminders: () => require('../notifications/scheduler').runDueNotifications(),
  };
}

async function persist(record) {
  try {
    const AdminJobRun = require('../../models/AdminJobRun');
    await AdminJobRun.create(record);
  } catch (err) {
    console.warn('job log skipped:', err?.message || err);
  }
}

async function runTrackedJob(name, fn) {
  const startedAt = new Date();
  const startedMs = Date.now();
  let status = 'success';
  let error = null;
  try {
    await Promise.resolve().then(() => fn());
  } catch (err) {
    status = 'failed';
    error = sanitizeMessage(err?.message || 'Job failed');
  }
  const record = {
    name,
    status,
    startedAt,
    finishedAt: new Date(),
    durationMs: Date.now() - startedMs,
    error,
    nextRunAt: INTERVALS[name] ? new Date(Date.now() + INTERVALS[name]) : null,
  };
  latest.set(name, record);
  await persist(record);
  if (status === 'failed') {
    console.warn(`job ${name}:`, error);
  }
  return record;
}

async function retryJob(name) {
  if (!RETRYABLE.has(name)) {
    const err = new Error('This job cannot be retried from the admin panel');
    err.status = 400;
    throw err;
  }
  return runTrackedJob(name, jobHandlers()[name]);
}

async function listJobs() {
  const names = Object.keys(INTERVALS);
  let rows = [];
  try {
    const { Op } = require('sequelize');
    const AdminJobRun = require('../../models/AdminJobRun');
    rows = await AdminJobRun.findAll({
      where: { name: { [Op.in]: names } },
      order: [['startedAt', 'DESC']],
      limit: 100,
    });
  } catch (_err) {
    rows = [];
  }
  const byName = new Map();
  for (const name of names) {
    byName.set(name, latest.get(name) || null);
  }
  for (const row of rows) {
    const plain = row.toJSON ? row.toJSON() : row;
    if (!byName.get(plain.name)) byName.set(plain.name, plain);
  }
  const jobs = names.map((name) => {
    const row = byName.get(name);
    return {
      name,
      status: row?.status || 'UNKNOWN',
      lastRun: row?.startedAt || null,
      finishedAt: row?.finishedAt || null,
      nextRun: row?.nextRunAt || null,
      durationMs: row?.durationMs ?? null,
      failures: row?.status === 'failed' ? 1 : 0,
      error: row?.error || null,
      retryable: true,
    };
  });
  const recent = rows.slice(0, 30).map((row) => (row.toJSON ? row.toJSON() : row));
  return { jobs, recent };
}

function failedJobCount() {
  let count = 0;
  for (const name of Object.keys(INTERVALS)) {
    const row = latest.get(name);
    if (row?.status === 'failed') count += 1;
  }
  return count;
}

module.exports = {
  INTERVALS,
  RETRYABLE,
  runTrackedJob,
  retryJob,
  listJobs,
  failedJobCount,
};
