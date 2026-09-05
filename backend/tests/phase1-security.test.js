/**
 * Phase 1 security unit tests (no DB required for jwtSecret / ACL pattern checks).
 * Run: node --test tests/phase1-security.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('getJwtSecret', () => {
  const originalEnv = { ...process.env };

  const loadFresh = () => {
    const modPath = require.resolve('../utils/jwtSecret');
    delete require.cache[modPath];
    return require('../utils/jwtSecret');
  };

  it('returns JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'test-secret-value';
    process.env.NODE_ENV = 'production';
    const { getJwtSecret } = loadFresh();
    assert.equal(getJwtSecret(), 'test-secret-value');
  });

  it('throws in production when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const { getJwtSecret } = loadFresh();
    assert.throws(() => getJwtSecret(), /JWT_SECRET is required in production/);
  });

  it('allows insecure fallback outside production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    const { getJwtSecret } = loadFresh();
    assert.equal(getJwtSecret(), 'dev_jwt_secret');
  });

  // restore
  process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  process.env.NODE_ENV = originalEnv.NODE_ENV;
});

describe('LiveKit room pattern ACL (mocked models)', () => {
  it('denies unknown room names', async () => {
    // Mock models before requiring ACL module
    const videoCallPath = require.resolve('../models/VideoCall');
    const streamPath = require.resolve('../models/Stream');
    const conversationPath = require.resolve('../models/Conversation');

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
      exports: { findByPk: async () => null },
    };
    require.cache[conversationPath] = {
      id: conversationPath,
      filename: conversationPath,
      loaded: true,
      exports: { ConversationMember: { findOne: async () => null } },
    };

    const aclPath = path.resolve(__dirname, '../utils/livekitAcl.js');
    delete require.cache[aclPath];
    const { authorizeLiveKitRoom } = require('../utils/livekitAcl');

    const denied = await authorizeLiveKitRoom(1, 'smoke-test-room', { canPublish: true });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);

    const badUser = await authorizeLiveKitRoom(null, 'call-1', { canPublish: true });
    assert.equal(badUser.ok, false);
    assert.equal(badUser.status, 401);
  });

  it('allows call participant and denies outsider', async () => {
    const videoCallPath = require.resolve('../models/VideoCall');
    const streamPath = require.resolve('../models/Stream');
    const conversationPath = require.resolve('../models/Conversation');

    require.cache[videoCallPath] = {
      id: videoCallPath,
      filename: videoCallPath,
      loaded: true,
      exports: {
        findByPk: async (id) =>
          String(id) === '42'
            ? { id: 42, callerId: 10, receiverId: 20 }
            : null,
      },
    };
    require.cache[streamPath] = {
      id: streamPath,
      filename: streamPath,
      loaded: true,
      exports: { findByPk: async () => null },
    };
    require.cache[conversationPath] = {
      id: conversationPath,
      filename: conversationPath,
      loaded: true,
      exports: { ConversationMember: { findOne: async () => null } },
    };

    const aclPath = path.resolve(__dirname, '../utils/livekitAcl.js');
    delete require.cache[aclPath];
    const { authorizeLiveKitRoom } = require('../utils/livekitAcl');

    const caller = await authorizeLiveKitRoom(10, 'call-42', { canPublish: true });
    assert.equal(caller.ok, true);
    assert.equal(caller.role, 'caller');

    const outsider = await authorizeLiveKitRoom(99, 'call-42', { canPublish: true });
    assert.equal(outsider.ok, false);
    assert.equal(outsider.status, 403);
  });

  it('allows stream viewer subscribe but not publish for non-owner', async () => {
    const videoCallPath = require.resolve('../models/VideoCall');
    const streamPath = require.resolve('../models/Stream');
    const conversationPath = require.resolve('../models/Conversation');

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
        findByPk: async (id) =>
          String(id) === '7' ? { id: 7, streamerId: 5 } : null,
      },
    };
    require.cache[conversationPath] = {
      id: conversationPath,
      filename: conversationPath,
      loaded: true,
      exports: { ConversationMember: { findOne: async () => null } },
    };

    const aclPath = path.resolve(__dirname, '../utils/livekitAcl.js');
    delete require.cache[aclPath];
    const { authorizeLiveKitRoom } = require('../utils/livekitAcl');

    const viewerOk = await authorizeLiveKitRoom(99, 'stream-7', { canPublish: false });
    assert.equal(viewerOk.ok, true);
    assert.equal(viewerOk.role, 'viewer');

    const publishDenied = await authorizeLiveKitRoom(99, 'stream-7', { canPublish: true });
    assert.equal(publishDenied.ok, false);
    assert.equal(publishDenied.status, 403);

    const ownerPublish = await authorizeLiveKitRoom(5, 'stream-7', { canPublish: true });
    assert.equal(ownerPublish.ok, true);
    assert.equal(ownerPublish.role, 'streamer');
  });
});

describe('socketAuth middleware', () => {
  it('rejects invalid token', async () => {
    process.env.JWT_SECRET = 'phase1-test-secret';
    process.env.NODE_ENV = 'test';
    const modPath = require.resolve('../middleware/socketAuth');
    delete require.cache[modPath];
    delete require.cache[require.resolve('../utils/jwtSecret')];
    const socketAuth = require('../middleware/socketAuth');

    const socket = {
      handshake: { auth: { token: 'not-a-jwt' }, headers: {} },
      data: {},
    };

    await new Promise((resolve) => {
      socketAuth(socket, (err) => {
        assert.ok(err);
        assert.match(String(err.message), /Unauthorized/);
        resolve();
      });
    });
  });

  it('allows anonymous when no token', async () => {
    process.env.JWT_SECRET = 'phase1-test-secret';
    const modPath = require.resolve('../middleware/socketAuth');
    delete require.cache[modPath];
    delete require.cache[require.resolve('../utils/jwtSecret')];
    const socketAuth = require('../middleware/socketAuth');

    const socket = {
      handshake: { auth: {}, headers: {} },
      data: {},
    };

    await new Promise((resolve) => {
      socketAuth(socket, (err) => {
        assert.equal(err, undefined);
        assert.equal(socket.userId, null);
        assert.equal(socket.data.anonymous, true);
        resolve();
      });
    });
  });

  it('sets userId from valid JWT', async () => {
    process.env.JWT_SECRET = 'phase1-test-secret';
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ user: { id: 123 } }, 'phase1-test-secret');

    const modPath = require.resolve('../middleware/socketAuth');
    delete require.cache[modPath];
    delete require.cache[require.resolve('../utils/jwtSecret')];
    const socketAuth = require('../middleware/socketAuth');

    const socket = {
      handshake: { auth: { token }, headers: {} },
      data: {},
    };

    await new Promise((resolve) => {
      socketAuth(socket, (err) => {
        assert.equal(err, undefined);
        assert.equal(socket.userId, '123');
        assert.equal(socket.data.anonymous, false);
        resolve();
      });
    });
  });
});
