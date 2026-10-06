'use strict';

const crypto = require('crypto');

const memory = new Map();

function sanitizeMessage(message) {
  return String(message || 'error')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres:\/\/\S+/gi, '[database]')
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 300);
}

function fingerprintFor({ method, path, message }) {
  return crypto
    .createHash('sha256')
    .update(`${method}|${path}|${message}`)
    .digest('hex')
    .slice(0, 40);
}

function severityFor(statusCode) {
  const status = Number(statusCode) || 500;
  if (status >= 500) return 'HIGH';
  return 'MEDIUM';
}

async function captureError(err, req = {}) {
  const statusCode = Number(err?.status || err?.statusCode || 500);
  if (statusCode < 500 && !err?.forceRecord) return null;
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path || req.originalUrl || 'unknown')
    .split('?')[0]
    .replace(/\/\d+/g, '/:id')
    .slice(0, 191);
  const message = sanitizeMessage(err?.message || 'Server error');
  const fingerprint = fingerprintFor({ method, path, message });
  const now = new Date();
  const current = memory.get(fingerprint) || {
    fingerprint,
    method,
    path,
    message,
    severity: severityFor(statusCode),
    statusCode,
    count: 0,
    firstSeenAt: now,
    lastSeenAt: now,
  };
  current.count += 1;
  current.lastSeenAt = now;
  current.statusCode = statusCode;
  memory.set(fingerprint, current);

  try {
    const AdminErrorGroup = require('../../models/AdminErrorGroup');
    const existing = await AdminErrorGroup.findOne({ where: { fingerprint } });
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      existing.statusCode = statusCode;
      await existing.save();
    } else {
      await AdminErrorGroup.create({
        fingerprint,
        method,
        path,
        message,
        severity: current.severity,
        statusCode,
        count: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  } catch (storeErr) {
    console.warn('error center store skipped:', storeErr?.message || storeErr);
  }
  return { ...current };
}

async function listErrors({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  try {
    const AdminErrorGroup = require('../../models/AdminErrorGroup');
    const result = await AdminErrorGroup.findAndCountAll({
      order: [['lastSeenAt', 'DESC']],
      limit,
      offset,
    });
    return {
      source: 'database',
      rows: result.rows.map((row) => row.toJSON()),
      total: result.count,
      page,
      pages: Math.max(1, Math.ceil(result.count / limit)),
    };
  } catch (err) {
    const rows = [...memory.values()].sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    return {
      source: 'process',
      note: err?.message ? 'Stored error groups are unavailable. Showing this process only.' : undefined,
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      page,
      pages: Math.max(1, Math.ceil(rows.length / limit) || 1),
    };
  }
}

function resetErrors() {
  memory.clear();
}

module.exports = {
  sanitizeMessage,
  fingerprintFor,
  captureError,
  listErrors,
  resetErrors,
};
