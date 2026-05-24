#!/usr/bin/env node
/**
 * Smoke test për video/audio calls + LiveKit token.
 *
 * Usage:
 *   API_URL=https://footballpro.onrender.com node scripts/smoke-video-calls.js
 *
 * Me llogari ekzistuese:
 *   TEST_EMAIL=... TEST_PASSWORD=... TEST_RECEIVER_ID=123 node scripts/smoke-video-calls.js
 *
 * Ose dy llogari:
 *   TEST_EMAIL=... TEST_PASSWORD=... TEST_EMAIL2=... TEST_PASSWORD2=... node scripts/smoke-video-calls.js
 */

const axios = require('axios');
const crypto = require('crypto');

const base = (process.env.API_URL || 'http://localhost:10000').replace(/\/$/, '');
const frontend = (process.env.FRONTEND_URL || 'https://footballpro-1.onrender.com').replace(/\/$/, '');

let failed = 0;
let passed = 0;

function pass(msg) {
  passed += 1;
  console.log(`PASS  ${msg}`);
}

function fail(msg, detail) {
  failed += 1;
  console.log(`FAIL  ${msg}${detail ? ` — ${detail}` : ''}`);
}

function skip(msg) {
  console.log(`SKIP  ${msg}`);
}

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios.get(`${base}${path}`, { headers, validateStatus: () => true, timeout: 25000 });
}

async function post(path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios.post(`${base}${path}`, body, { headers, validateStatus: () => true, timeout: 25000 });
}

async function put(path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios.put(`${base}${path}`, body, { headers, validateStatus: () => true, timeout: 25000 });
}

async function login(email, password) {
  const res = await post('/api/auth/login', { email, password });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`login failed ${res.status}: ${JSON.stringify(res.data).slice(0, 120)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function registerUser(suffix) {
  const email = `smoke-call-${suffix}-${Date.now()}@footballpro-smoke.invalid`;
  const password = `Smoke${crypto.randomBytes(4).toString('hex')}!9`;
  const res = await post('/api/auth/register', {
    email,
    password,
    firstName: 'Smoke',
    lastName: suffix,
    role: 'athlete',
    dateOfBirth: '2000-01-15',
  });
  if (res.status !== 201 || !res.data?.token) {
    throw new Error(`register failed ${res.status}: ${JSON.stringify(res.data).slice(0, 160)}`);
  }
  return {
    email,
    password,
    token: res.data.token,
    userId: res.data.user?.id,
  };
}

async function testPublic() {
  const cfg = await get('/api/config/public');
  if (cfg.status === 200 && cfg.data?.livekitConfigured) {
    pass('GET /api/config/public — livekitConfigured=true');
  } else if (cfg.status === 200) {
    fail('GET /api/config/public', 'livekitConfigured=false (video calls need LiveKit on server)');
  } else {
    fail('GET /api/config/public', `status ${cfg.status}`);
  }

  const unauthStart = await post('/api/video-calls/start', { receiverId: 1 });
  if (unauthStart.status === 401) pass('POST /api/video-calls/start requires auth (401)');
  else fail('POST /api/video-calls/start unauth', `expected 401, got ${unauthStart.status}`);

  const unauthLk = await post('/api/livekit/token', { roomName: 'smoke-test-room' });
  if (unauthLk.status === 401) pass('POST /api/livekit/token requires auth (401)');
  else fail('POST /api/livekit/token unauth', `expected 401, got ${unauthLk.status}`);

  for (const path of ['/embed-call', '/embed-incoming-call']) {
    try {
      const res = await axios.head(`${frontend}${path}`, { validateStatus: () => true, timeout: 15000 });
      if (res.status >= 200 && res.status < 400) pass(`Frontend ${path} reachable (${res.status})`);
      else fail(`Frontend ${path}`, `status ${res.status}`);
    } catch (e) {
      fail(`Frontend ${path}`, e.message);
    }
  }
}

async function testCallFlow(callerToken, receiverId, receiverToken) {
  const start = await post('/api/video-calls/start', { receiverId }, callerToken);
  if (start.status !== 200 || !start.data?.id) {
    fail('POST /api/video-calls/start', `status ${start.status} ${JSON.stringify(start.data).slice(0, 120)}`);
    return null;
  }
  pass(`POST /api/video-calls/start — call id ${start.data.id}`);
  const callId = start.data.id;

  const activeCaller = await get('/api/video-calls/active', callerToken);
  if (activeCaller.status === 200 && activeCaller.data?.id === callId) {
    pass('GET /api/video-calls/active — caller sees ringing call');
  } else {
    fail('GET /api/video-calls/active (caller)', `status ${activeCaller.status}`);
  }

  const activeReceiver = await get('/api/video-calls/active', receiverToken);
  if (activeReceiver.status === 200 && activeReceiver.data?.id === callId) {
    pass('GET /api/video-calls/active — receiver sees incoming call');
  } else {
    fail('GET /api/video-calls/active (receiver)', `status ${activeReceiver.status}`);
  }

  const roomName = `call-${callId}`;
  const lkCaller = await post(
    '/api/livekit/token',
    { roomName, canPublish: true, canSubscribe: true, metadata: { callId, role: 'caller' } },
    callerToken
  );
  if (lkCaller.status === 200 && lkCaller.data?.token && lkCaller.data?.wsUrl) {
    pass('POST /api/livekit/token — caller token + wsUrl');
  } else {
    fail('POST /api/livekit/token (caller)', `status ${lkCaller.status} ${JSON.stringify(lkCaller.data).slice(0, 100)}`);
  }

  const lkReceiver = await post(
    '/api/livekit/token',
    { roomName, canPublish: true, canSubscribe: true, metadata: { callId, role: 'receiver' } },
    receiverToken
  );
  if (lkReceiver.status === 200 && lkReceiver.data?.token) {
    pass('POST /api/livekit/token — receiver token');
  } else {
    fail('POST /api/livekit/token (receiver)', `status ${lkReceiver.status}`);
  }

  const connected = await put(`/api/video-calls/${callId}/status`, { status: 'connected' }, receiverToken);
  if (connected.status === 200 && connected.data?.status === 'connected') {
    pass('PUT /api/video-calls/:id/status — connected');
  } else {
    fail('PUT /api/video-calls/:id/status', `status ${connected.status}`);
  }

  const ended = await put(`/api/video-calls/${callId}/end`, {}, callerToken);
  if (ended.status === 200) {
    pass('PUT /api/video-calls/:id/end');
  } else {
    fail('PUT /api/video-calls/:id/end', `status ${ended.status}`);
  }

  const history = await get('/api/video-calls/history', callerToken);
  if (history.status === 200 && Array.isArray(history.data)) {
    const found = history.data.some((c) => c.id === callId);
    if (found) pass('GET /api/video-calls/history — call recorded');
    else fail('GET /api/video-calls/history', 'ended, not in list');
  } else {
    fail('GET /api/video-calls/history', `status ${history.status}`);
  }

  const createAlt = await post('/api/video-calls/create', { participantId: receiverId }, callerToken);
  if (createAlt.status === 200 && createAlt.data?.id) {
    pass('POST /api/video-calls/create');
    await put(`/api/video-calls/${createAlt.data.id}/end`, {}, callerToken);
  } else {
    fail('POST /api/video-calls/create', `status ${createAlt.status}`);
  }

  return callId;
}

async function main() {
  console.log(`\nFootballPro video-calls smoke — API ${base}\n`);

  await testPublic();

  let callerToken;
  let receiverToken;
  let receiverId;

  const email1 = process.env.TEST_EMAIL;
  const pass1 = process.env.TEST_PASSWORD;
  const email2 = process.env.TEST_EMAIL2;
  const pass2 = process.env.TEST_PASSWORD2;
  const receiverIdEnv = process.env.TEST_RECEIVER_ID ? Number(process.env.TEST_RECEIVER_ID) : null;

  if (email1 && pass1) {
    try {
      const c = await login(email1, pass1);
      callerToken = c.token;
      pass(`Login caller ${email1}`);
    } catch (e) {
      fail('Login caller', e.message);
    }
  }

  if (email2 && pass2) {
    try {
      const r = await login(email2, pass2);
      receiverToken = r.token;
      receiverId = r.user?.id;
      pass(`Login receiver ${email2}`);
    } catch (e) {
      fail('Login receiver', e.message);
    }
  } else if (receiverIdEnv && callerToken) {
    receiverId = receiverIdEnv;
    skip(`Using TEST_RECEIVER_ID=${receiverId} (receiver token tests limited)`);
  }

  if (!callerToken || !receiverId) {
    console.log('\nNo TEST_EMAIL pair — registering ephemeral smoke users…\n');
    try {
      const caller = await registerUser('Caller');
      const receiver = await registerUser('Receiver');
      callerToken = caller.token;
      receiverToken = receiver.token;
      receiverId = receiver.userId;
      pass(`Registered smoke caller id=${caller.userId}`);
      pass(`Registered smoke receiver id=${receiver.userId}`);
    } catch (e) {
      fail('Ephemeral register', e.message);
      console.log(failed ? `\n${failed} failure(s), ${passed} passed.\n` : `\n${passed} passed.\n`);
      process.exit(1);
    }
  }

  if (callerToken && receiverId) {
    if (!receiverToken) {
      skip('Full receiver-side checks (no receiver token)');
      await testCallFlow(callerToken, receiverId, callerToken);
    } else {
      await testCallFlow(callerToken, receiverId, receiverToken);
    }
  }

  console.log(failed ? `\n${failed} failure(s), ${passed} passed.\n` : `\nAll ${passed} checks passed.\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
