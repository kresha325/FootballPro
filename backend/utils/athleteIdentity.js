'use strict';

const crypto = require('crypto');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeAthleteIdentityKey(value) {
  const candidate = String(value || '').trim();
  return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

function createAthleteIdentityKey() {
  return crypto.randomUUID();
}

module.exports = { UUID_PATTERN, normalizeAthleteIdentityKey, createAthleteIdentityKey };
