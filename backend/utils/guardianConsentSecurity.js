'use strict';

const crypto = require('crypto');

function createRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function isUnexpired(expiresAt, now = Date.now()) {
  const timestamp = expiresAt ? new Date(expiresAt).getTime() : NaN;
  return Number.isFinite(timestamp) && timestamp > now;
}

module.exports = { createRawToken, hashToken, isUnexpired };
