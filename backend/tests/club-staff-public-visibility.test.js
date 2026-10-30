'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ClubStaff = require('../models/ClubStaff');
const User = require('../models/User');
const router = require('../routes/clubStaff');

const route = router.stack.find((layer) => layer.route?.path === '/club/:clubId');
const handler = route.route.stack.at(-1).handle;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request({ status, user, teamType } = {}) {
  return {
    params: { clubId: '8' },
    query: { ...(status ? { status } : {}), ...(teamType ? { teamType } : {}) },
    user,
    headers: {},
  };
}

describe('public club staff visibility', () => {
  const originalFindAll = ClubStaff.findAll;
  const originalUserFindByPk = User.findByPk;

  it('rejects public requests for pending or inactive assignments', async () => {
    let queried = false;
    ClubStaff.findAll = async () => { queried = true; return []; };
    try {
      const res = response();
      await handler(request({ status: 'pending' }), res);
      assert.equal(res.statusCode, 403);
      assert.equal(queried, false);
    } finally {
      ClubStaff.findAll = originalFindAll;
    }
  });

  it('defaults public requests to current active staff and filters expired or departed records', async () => {
    let options;
    ClubStaff.findAll = async (query) => {
      options = query;
      return [
        { id: 1, status: 'active', contractUntil: null, leftAt: null, staff: { id: 31 } },
        { id: 2, status: 'active', contractUntil: '2099-12-31', leftAt: null, staff: { id: 32 } },
        { id: 3, status: 'active', contractUntil: '2000-01-01', leftAt: null, staff: { id: 33 } },
        { id: 4, status: 'inactive', contractUntil: null, leftAt: null, staff: { id: 34 } },
        { id: 5, status: 'active', contractUntil: null, leftAt: new Date(), staff: { id: 35 } },
        { id: 6, status: 'active', contractUntil: 'not-a-date', leftAt: null, staff: { id: 36 } },
        { id: 7, status: 'active', contractUntil: null, leftAt: null, staff: null },
        { id: 8, status: 'active', contractUntil: null, leftAt: null, staff: { id: 37, bannedAt: new Date() } },
      ];
    };
    try {
      const res = response();
      await handler(request(), res);
      assert.deepEqual(options.where, { clubId: 8, status: 'active', leftAt: null });
      assert.deepEqual(res.body.map((row) => row.id), [1, 2]);
    } finally {
      ClubStaff.findAll = originalFindAll;
    }
  });

  it('allows a verified club to view its own pending assignments', async () => {
    let options;
    User.findByPk = async () => ({ id: 8, role: 'club', adminVerified: true, bannedAt: null, deletedAt: null });
    ClubStaff.findAll = async (query) => {
      options = query;
      return [{ id: 10, status: 'pending', leftAt: null }];
    };
    try {
      const res = response();
      await handler(request({ status: 'pending', user: { id: 8, role: 'club' } }), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(options.where, { clubId: 8, status: 'pending' });
      assert.deepEqual(res.body.map((row) => row.id), [10]);
    } finally {
      ClubStaff.findAll = originalFindAll;
      User.findByPk = originalUserFindByPk;
    }
  });

  it('does not allow an unverified club to read pending assignments', async () => {
    let queried = false;
    User.findByPk = async () => ({ id: 8, role: 'club', adminVerified: false, bannedAt: null, deletedAt: null });
    ClubStaff.findAll = async () => { queried = true; return []; };
    try {
      const res = response();
      await handler(request({ status: 'pending', user: { id: 8, role: 'club' } }), res);
      assert.equal(res.statusCode, 403);
      assert.equal(queried, false);
    } finally {
      ClubStaff.findAll = originalFindAll;
      User.findByPk = originalUserFindByPk;
    }
  });

  it('allows platform admins to inspect inactive assignments', async () => {
    let options;
    ClubStaff.findAll = async (query) => { options = query; return []; };
    try {
      const res = response();
      await handler(request({ status: 'inactive', user: { id: 99, role: 'admin' } }), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(options.where, { clubId: 8, status: 'inactive' });
    } finally {
      ClubStaff.findAll = originalFindAll;
    }
  });

  it('rejects unsupported staff status filters', async () => {
    const res = response();
    await handler(request({ status: 'deleted' }), res);
    assert.equal(res.statusCode, 400);
  });
});
