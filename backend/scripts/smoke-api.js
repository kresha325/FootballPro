#!/usr/bin/env node
/**
 * Smoke test against a running API (local or production).
 * Usage:
 *   API_URL=https://footballpro.onrender.com TEST_EMAIL=... TEST_PASSWORD=... node scripts/smoke-api.js
 */

const axios = require('axios');

const base = (process.env.API_URL || 'http://localhost:10000').replace(/\/$/, '');
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

let failed = 0;

function pass(msg) {
  console.log(`PASS  ${msg}`);
}

function fail(msg, detail) {
  console.log(`FAIL  ${msg}${detail ? ` — ${detail}` : ''}`);
  failed += 1;
}

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios.get(`${base}${path}`, { headers, validateStatus: () => true });
}

async function post(path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios.post(`${base}${path}`, body, { headers, validateStatus: () => true });
}

async function main() {
  console.log(`\nFootballPro API smoke — ${base}\n`);

  const cfg = await get('/api/config/public');
  if (cfg.status === 200 && cfg.data.paymentsEnabled === false) {
    pass('GET /api/config/public (payments disabled)');
  } else if (cfg.status === 200) {
    pass('GET /api/config/public');
  } else {
    fail('GET /api/config/public', `status ${cfg.status}`);
  }

  const streams = await get('/api/streams');
  if (streams.status === 200) pass('GET /api/streams');
  else fail('GET /api/streams', `status ${streams.status} ${JSON.stringify(streams.data).slice(0, 120)}`);

  if (!email || !password) {
    console.log('\nSKIP  auth tests (set TEST_EMAIL and TEST_PASSWORD)\n');
    process.exit(failed ? 1 : 0);
  }

  const login = await post('/api/auth/login', { email, password });
  if (login.status !== 200 || !login.data?.token) {
    fail('POST /api/auth/login', `status ${login.status}`);
    process.exit(1);
  }
  pass('POST /api/auth/login');
  const token = login.data.token;

  const me = await get('/api/auth/me', token);
  if (me.status === 200) pass('GET /api/auth/me');
  else fail('GET /api/auth/me', `status ${me.status}`);

  const tournaments = await get('/api/tournaments', token);
  if (tournaments.status === 200) pass('GET /api/tournaments');
  else fail('GET /api/tournaments', `status ${tournaments.status}`);

  const premium = await post('/api/premium/checkout', { plan: 'monthly' }, token);
  if (premium.status === 200 && premium.data.mode === 'demo') {
    pass('POST /api/premium/checkout (demo mode)');
  } else if (premium.status === 200 && premium.data.mode === 'stripe') {
    fail('POST /api/premium/checkout', 'expected demo mode (PAYMENTS_ENABLED should be false)');
  } else {
    fail('POST /api/premium/checkout', `status ${premium.status}`);
  }

  const push = await post('/api/profiles/me/push-token', { type: 'mobile', token: 'ExponentPushToken[smoke-test]' }, token);
  if (push.status === 200) pass('POST /api/profiles/me/push-token');
  else fail('POST /api/profiles/me/push-token', `status ${push.status}`);

  const leaderboard = await get('/api/gamification/leaderboard', token);
  if (leaderboard.status === 200 && Array.isArray(leaderboard.data?.leaderboard)) {
    pass('GET /api/gamification/leaderboard');
  } else {
    fail('GET /api/gamification/leaderboard', `status ${leaderboard.status} ${JSON.stringify(leaderboard.data).slice(0, 120)}`);
  }

  console.log(failed ? `\n${failed} failure(s).\n` : '\nAll smoke checks passed.\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
