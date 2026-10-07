/**
 * Phase 6: LiveKit anonymous subscribe ACL and football proxy cache.
 * Run: node --test tests/phase6-livekit-football.test.js
 */
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');
const express = require('express');

const streams = new Map();

function installModelMocks() {
  const videoCallPath = require.resolve('../models/VideoCall');
  const streamPath = require.resolve('../models/Stream');
  const conversationPath = require.resolve('../models/Conversation');
  const userPath = require.resolve('../models/User');
  const saved = {
    videoCallPath,
    streamPath,
    conversationPath,
    userPath,
    videoCall: require.cache[videoCallPath],
    stream: require.cache[streamPath],
    conversation: require.cache[conversationPath],
    user: require.cache[userPath],
  };
  require.cache[videoCallPath] = {
    id: videoCallPath,
    filename: videoCallPath,
    loaded: true,
    exports: { findByPk: async () => null },
  };
  require.cache[streamPath] = {
    id: streamPath,
    filename: streamPath,
    loaded: true,
    exports: {
      findByPk: async (id) => streams.get(String(id)) || null,
    },
  };
  require.cache[conversationPath] = {
    id: conversationPath,
    filename: conversationPath,
    loaded: true,
    exports: { ConversationMember: { findOne: async () => null } },
  };
  require.cache[userPath] = {
    id: userPath,
    filename: userPath,
    loaded: true,
    exports: { findByPk: async () => null },
  };
  const aclPath = path.resolve(__dirname, '../utils/livekitAcl.js');
  delete require.cache[aclPath];
  return saved;
}

function restoreModelMocks(saved) {
  const entries = [
    [saved.videoCallPath, saved.videoCall],
    [saved.streamPath, saved.stream],
    [saved.conversationPath, saved.conversation],
    [saved.userPath, saved.user],
  ];
  for (const [modPath, previous] of entries) {
    if (previous) require.cache[modPath] = previous;
    else delete require.cache[modPath];
  }
  delete require.cache[path.resolve(__dirname, '../utils/livekitAcl.js')];
}

describe('LiveKit room ACL', () => {
  let saved;
  let authorizeAnonymousStreamViewer;
  let authorizeLiveKitRoom;

  it('gives anonymous viewers a subscribe role only for a live public stream', async () => {
    saved = installModelMocks();
    ({ authorizeAnonymousStreamViewer, authorizeLiveKitRoom } = require('../utils/livekitAcl'));

    streams.set('7', { id: 7, streamerId: 5, isLive: true, isPremium: false, visibility: 'public' });
    const allowed = await authorizeAnonymousStreamViewer('stream-7');
    assert.equal(allowed.ok, true);
    assert.equal(allowed.role, 'viewer');

    streams.set('8', { id: 8, streamerId: 5, isLive: true, isPremium: false, visibility: 'unlisted' });
    const unlisted = await authorizeAnonymousStreamViewer('stream-8');
    assert.equal(unlisted.ok, true);
    assert.equal(unlisted.role, 'viewer');

    streams.set('9', { id: 9, streamerId: 5, isLive: true, isPremium: false, visibility: 'private' });
    const privateRoom = await authorizeAnonymousStreamViewer('stream-9');
    assert.equal(privateRoom.ok, false);
    assert.equal(privateRoom.status, 401);

    streams.set('10', { id: 10, streamerId: 5, isLive: false, isPremium: false, visibility: 'public' });
    const offline = await authorizeAnonymousStreamViewer('stream-10');
    assert.equal(offline.ok, false);
    assert.equal(offline.status, 403);

    const missing = await authorizeAnonymousStreamViewer('stream-404');
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 404);

    const callRoom = await authorizeAnonymousStreamViewer('call-1');
    assert.equal(callRoom.ok, false);
    assert.equal(callRoom.status, 401);

    const stranger = await authorizeLiveKitRoom(99, 'stream-9', { canPublish: false });
    assert.equal(stranger.ok, false);
    assert.equal(stranger.status, 403);

    const owner = await authorizeLiveKitRoom(5, 'stream-9', { canPublish: true });
    assert.equal(owner.ok, true);
    assert.equal(owner.role, 'streamer');
  });

  after(() => {
    if (saved) restoreModelMocks(saved);
  });
});

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('football proxy', () => {
  it('caches a successful response for 60s and rejects a bad league before the upstream call', async () => {
    const axiosPath = require.resolve('axios');
    const controllerPath = require.resolve('../controllers/football');
    const savedAxios = require.cache[axiosPath];
    const savedController = require.cache[controllerPath];
    let calls = 0;
    require.cache[axiosPath] = {
      id: axiosPath,
      filename: axiosPath,
      loaded: true,
      exports: {
        get: async (url) => {
          calls += 1;
          return { data: { source: url, n: calls } };
        },
      },
    };
    delete require.cache[controllerPath];
    const football = require('../controllers/football');

    try {
      const first = mockRes();
      await football.getFixtures({ query: { league: 'PL', season: '2024' } }, first);
      const second = mockRes();
      await football.getFixtures({ query: { league: 'PL', season: '2024' } }, second);
      assert.equal(calls, 1);
      assert.deepEqual(second.body, first.body);
      assert.equal(first.body.source, 'https://api.football-data.org/v4/competitions/PL/matches?season=2024');

      const bad = mockRes();
      await football.getFixtures({ query: { league: '../admin', season: '2024' } }, bad);
      assert.equal(bad.statusCode, 400);
      assert.equal(calls, 1);

      const badSeason = mockRes();
      await football.getStats({ query: { league: 'PL', season: '20' } }, badSeason);
      assert.equal(badSeason.statusCode, 400);
      assert.equal(calls, 1);
    } finally {
      if (savedAxios) require.cache[axiosPath] = savedAxios;
      else delete require.cache[axiosPath];
      if (savedController) require.cache[controllerPath] = savedController;
      else delete require.cache[controllerPath];
    }
  });

  it('returns 429 after 30 requests from the same client', async () => {
    const footballRouter = require('../routes/football');
    const app = express();
    app.use('/api/football', footballRouter);
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const port = server.address().port;
    try {
      const hit = () => new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1',
          port,
          path: '/api/football/fixtures?league=not-a-code',
          method: 'GET',
        }, (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.end();
      });
      for (let i = 0; i < 30; i += 1) {
        assert.equal(await hit(), 400, `attempt ${i + 1} should be rejected as invalid`);
      }
      assert.equal(await hit(), 429);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
