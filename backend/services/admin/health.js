'use strict';

const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../../config/database');

const probes = {
  backend: { lastSuccessAt: null, lastFailureAt: null },
  database: { lastSuccessAt: null, lastFailureAt: null },
  storage: { lastSuccessAt: null, lastFailureAt: null },
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);
const SCAN_LIMIT = 2000;

function mark(key, ok) {
  const stamp = new Date().toISOString();
  if (ok) probes[key].lastSuccessAt = stamp;
  else probes[key].lastFailureAt = stamp;
  return { ...probes[key] };
}

function deriveServiceStatus(key, signals = {}) {
  if (key === 'payments') {
    if (signals.paymentsKnown === false) return 'UNKNOWN';
    const failed = Number(signals.failedPayments24h || 0);
    const success = Number(signals.successfulPayments24h || 0);
    if (failed >= 5 && failed > success) return 'ERROR';
    if (failed > 0) return 'DEGRADED';
    return 'ONLINE';
  }
  if (key === 'notifications') {
    if (signals.notificationsKnown === false) return 'UNKNOWN';
    const failed = Number(signals.notificationFailures24h || 0);
    if (failed >= 10) return 'ERROR';
    if (failed > 0) return 'DEGRADED';
    return 'ONLINE';
  }
  if (key === 'streaming') {
    if (signals.streamingKnown === false) return 'UNKNOWN';
    const failed = Number(signals.streamFailures24h || 0);
    if (failed >= 3) return 'ERROR';
    if (failed > 0) return 'DEGRADED';
    return 'ONLINE';
  }
  if (key === 'jobs') {
    if (signals.jobsKnown === false) return 'UNKNOWN';
    if (Number(signals.failedJobs || 0) > 0) return 'ERROR';
    if (!signals.jobsHaveRun) return 'UNKNOWN';
    return 'ONLINE';
  }
  return 'UNKNOWN';
}

async function scanUploads(dir) {
  let files = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  let uploadFailures = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (_err) {
      return { imageBytes: null, videoBytes: null, complete: false };
    }
    for (const entry of entries) {
      if (files >= SCAN_LIMIT) return { imageBytes: null, videoBytes: null, complete: false, uploadFailures: null };
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      files += 1;
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXT.has(ext) && !VIDEO_EXT.has(ext)) continue;
      try {
        const stat = await fs.promises.stat(full);
        if (IMAGE_EXT.has(ext)) imageBytes += stat.size;
        if (VIDEO_EXT.has(ext)) videoBytes += stat.size;
      } catch (_err) {
        uploadFailures = (uploadFailures || 0) + 1;
      }
    }
  }
  return { imageBytes, videoBytes, complete: true, uploadFailures };
}

async function checkStorage() {
  const uploads = path.join(__dirname, '../../uploads');
  try {
    const stat = await fs.promises.statfs(uploads);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bavail) * Number(stat.bsize);
    if (!Number.isFinite(total) || total <= 0) throw new Error('unavailable');
    const used = total - free;
    const percent = Math.round((used / total) * 1000) / 10;
    const scan = await scanUploads(uploads);
    const times = mark('storage', true);
    let status = 'ONLINE';
    if (percent >= 95) status = 'ERROR';
    else if (percent >= 80) status = 'DEGRADED';
    return {
      key: 'storage',
      label: 'STORAGE',
      status,
      latencyMs: null,
      percent,
      usedBytes: used,
      totalBytes: total,
      scope: 'Host disk that contains the uploads directory',
      providerQuota: 'NOT AVAILABLE',
      imageBytes: scan.complete ? scan.imageBytes : null,
      videoBytes: scan.complete ? scan.videoBytes : null,
      uploadFailures: scan.uploadFailures,
      ...times,
    };
  } catch (_err) {
    const times = mark('storage', false);
    return {
      key: 'storage',
      label: 'STORAGE',
      status: 'UNKNOWN',
      percent: null,
      providerQuota: 'NOT AVAILABLE',
      imageBytes: null,
      videoBytes: null,
      uploadFailures: null,
      detail: 'Storage metrics are not available on this host',
      ...times,
    };
  }
}

async function checkDatabase() {
  const started = Date.now();
  try {
    await sequelize.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - started;
    const times = mark('database', true);
    let sizeBytes = null;
    let connections = null;
    let migrations = null;
    try {
      const [sizeRow] = await sequelize.query(
        'SELECT pg_database_size(current_database()) AS bytes',
        { type: QueryTypes.SELECT }
      );
      sizeBytes = sizeRow?.bytes == null ? null : Number(sizeRow.bytes);
    } catch (_err) {
      sizeBytes = null;
    }
    try {
      const [conn] = await sequelize.query(
        'SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()',
        { type: QueryTypes.SELECT }
      );
      connections = conn?.n == null ? null : Number(conn.n);
    } catch (_err) {
      connections = null;
    }
    try {
      const [applied] = await sequelize.query(
        'SELECT COUNT(*)::int AS n FROM "SequelizeMeta"',
        { type: QueryTypes.SELECT }
      );
      const files = fs.readdirSync(path.join(__dirname, '../../migrations')).filter((name) => name.endsWith('.js')).length;
      const appliedCount = Number(applied?.n || 0);
      migrations = {
        applied: appliedCount,
        files,
        status: appliedCount === files ? 'current' : 'pending',
      };
    } catch (_err) {
      migrations = null;
    }
    return {
      key: 'database',
      label: 'DATABASE',
      status: migrations?.status === 'pending' ? 'DEGRADED' : 'ONLINE',
      latencyMs,
      sizeBytes,
      connections,
      migrations,
      ...times,
    };
  } catch (_err) {
    const times = mark('database', false);
    return {
      key: 'database',
      label: 'DATABASE',
      status: 'ERROR',
      latencyMs: null,
      sizeBytes: null,
      connections: null,
      migrations: null,
      detail: 'Database check failed',
      ...times,
    };
  }
}

async function checkBackend(startedAt) {
  const times = mark('backend', true);
  return {
    key: 'backend',
    label: 'BACKEND',
    status: 'ONLINE',
    latencyMs: Math.max(0, Date.now() - startedAt),
    ...times,
    lastFailureAt: probes.backend.lastFailureAt,
  };
}

function cacheStatus() {
  return {
    key: 'cache',
    label: 'CACHE',
    status: 'UNKNOWN',
    latencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    detail: 'No cache service is configured',
  };
}

module.exports = {
  deriveServiceStatus,
  checkStorage,
  checkDatabase,
  checkBackend,
  cacheStatus,
};
