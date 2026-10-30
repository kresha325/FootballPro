'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Stream = require('../models/Stream');
const User = require('../models/User');
const Guest = require('../models/LiveStreamGuest');
const moderation = require('../controllers/moderation');
const router = require('../routes/liveStreamGuest');

const inviteRoute = router.stack.find((layer) => layer.route?.path === '/invite').route.stack.at(-1).handle;
const statusRoute = router.stack.find((layer) => layer.route?.path === '/:guestId/status').route.stack.at(-1).handle;
const listRoute = router.stack.find((layer) => layer.route?.path === '/:streamId').route.stack.at(-1).handle;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request({ user, params = {}, body = {} } = {}) {
  return { user, params, body };
}

describe('live stream guest authorization', () => {
  const originalStreamFind = Stream.findByPk;
  const originalUserFind = User.findByPk;
  const originalGuestFind = Guest.findByPk;
  const originalGuestFindAll = Guest.findAll;
  const originalGuestFindOne = Guest.findOne;
  const originalGuestCreate = Guest.create;
  const originalIsEitherBlocked = moderation.isEitherBlocked;

  it('does not disclose private guest invitations to unrelated users', async () => {
    Stream.findByPk = async () => ({ id: 4, streamerId: 10, visibility: 'private' });
    Guest.findAll = async () => [{ id: 9, userId: 15, invitedBy: 10, status: 'pending' }];
    try {
      const res = response();
      await listRoute(request({ user: { id: 20, role: 'athlete' }, params: { streamId: '4' } }), res);
      assert.equal(res.statusCode, 404);
      assert.match(res.body.error, /not found/i);
    } finally {
      Stream.findByPk = originalStreamFind;
      Guest.findAll = originalGuestFindAll;
    }
  });

  it('shows owners all guests but public viewers only accepted and their own invitations', async () => {
    Stream.findByPk = async () => ({ id: 4, streamerId: 10, visibility: 'public' });
    Guest.findAll = async () => [
      { id: 1, userId: 11, invitedBy: 10, status: 'pending' },
      { id: 2, userId: 12, invitedBy: 10, status: 'accepted' },
    ];
    try {
      const ownerRes = response();
      await listRoute(request({ user: { id: 10, role: 'athlete' }, params: { streamId: '4' } }), ownerRes);
      assert.equal(ownerRes.body.length, 2);

      const viewerRes = response();
      await listRoute(request({ user: { id: 11, role: 'athlete' }, params: { streamId: '4' } }), viewerRes);
      assert.deepEqual(viewerRes.body.map((row) => row.id), [1, 2]);
      assert.equal(viewerRes.body[0].invitedBy, undefined);

      const unrelatedRes = response();
      await listRoute(request({ user: { id: 30, role: 'athlete' }, params: { streamId: '4' } }), unrelatedRes);
      assert.deepEqual(unrelatedRes.body.map((row) => row.id), [2]);
    } finally {
      Stream.findByPk = originalStreamFind;
      Guest.findAll = originalGuestFindAll;
    }
  });

  it('requires stream ownership and an unblocked, existing invitee', async () => {
    Stream.findByPk = async () => ({ id: 4, streamerId: 10 });
    User.findByPk = async () => ({ id: 12, deletedAt: null, bannedAt: null });
    Guest.findOne = async () => null;
    Guest.create = async (data) => ({ id: 1, ...data });
    moderation.isEitherBlocked = async () => false;
    try {
      const denied = response();
      await inviteRoute(request({ user: { id: 11, role: 'athlete' }, body: { streamId: 4, userId: 12 } }), denied);
      assert.equal(denied.statusCode, 403);

      const allowed = response();
      await inviteRoute(request({ user: { id: 10, role: 'athlete' }, body: { streamId: 4, userId: 12 } }), allowed);
      assert.equal(allowed.statusCode, 201);

      moderation.isEitherBlocked = async () => { throw new Error('DB unavailable'); };
      const failClosed = response();
      await inviteRoute(request({ user: { id: 10, role: 'athlete' }, body: { streamId: 4, userId: 12 } }), failClosed);
      assert.equal(failClosed.statusCode, 503);
    } finally {
      Stream.findByPk = originalStreamFind;
      User.findByPk = originalUserFind;
      Guest.findOne = originalGuestFindOne;
      Guest.create = originalGuestCreate;
      moderation.isEitherBlocked = originalIsEitherBlocked;
    }
  });

  it('allows only the invited user to accept or decline a pending invite', async () => {
    const guest = { id: 9, userId: 15, invitedBy: 10, status: 'pending', save: async () => guest };
    Guest.findByPk = async () => guest;
    try {
      const ownerRes = response();
      await statusRoute(request({ user: { id: 10, role: 'athlete' }, params: { guestId: '9' }, body: { status: 'accepted' } }), ownerRes);
      assert.equal(ownerRes.statusCode, 403);

      const badStateRes = response();
      await statusRoute(request({ user: { id: 15, role: 'athlete' }, params: { guestId: '9' }, body: { status: 'pending' } }), badStateRes);
      assert.equal(badStateRes.statusCode, 400);

      const guestRes = response();
      await statusRoute(request({ user: { id: 15, role: 'athlete' }, params: { guestId: '9' }, body: { status: 'accepted' } }), guestRes);
      assert.equal(guestRes.statusCode, 200);
      assert.equal(guest.status, 'accepted');
      assert.ok(guest.joinedAt instanceof Date);
    } finally {
      Guest.findByPk = originalGuestFind;
    }
  });
});
