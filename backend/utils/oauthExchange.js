'use strict';

const crypto = require('crypto');

const TTL_MS = 60 * 1000;
const codes = new Map();

function purge(now) {
  for (const [code, row] of codes) {
    if (row.expiresAt <= now) codes.delete(code);
  }
}

function issueOAuthCode(token, ttlMs = TTL_MS) {
  const now = Date.now();
  purge(now);
  const code = crypto.randomBytes(32).toString('base64url');
  codes.set(code, { token, expiresAt: now + ttlMs });
  return code;
}

function consumeOAuthCode(raw) {
  const now = Date.now();
  purge(now);
  const code = String(raw || '').trim();
  const row = codes.get(code);
  if (!row) return null;
  codes.delete(code);
  if (row.expiresAt <= now) return null;
  return row.token;
}

function oauthCallbackUrl({ mobile, frontendUrl, code }) {
  const value = encodeURIComponent(code);
  if (mobile) return `xtalenti://auth/callback?code=${value}`;
  const front = String(frontendUrl || 'https://xtalenti.com').replace(/\/$/, '');
  return `${front}/auth/callback?code=${value}`;
}

module.exports = {
  TTL_MS,
  issueOAuthCode,
  consumeOAuthCode,
  oauthCallbackUrl,
};
