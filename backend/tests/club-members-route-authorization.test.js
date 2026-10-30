'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ClubMember = require('../models/ClubMember');
const User = require('../models/User');
const router = require('../routes/clubMembers');

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

function request({ user, status } = {}) {
  return {
    params: { clubId: '8' },
    query: status ? { status } : {},
    user,
  };
}

describe('club membership route authorization', () => {
  const originalFindByPk = User.findByPk;
  const originalFindAll = ClubMember.findAll;

  it('does not let an unverified club inspect pending membership requests', async () => {
    let queried = false;
    User.findByPk = async () => ({ id: 8, role: 'club', adminVerified: false });
    ClubMember.findAll = async () => { queried = true; return []; };
    try {
      const res = response();
      await handler(request({ user: { id: 8, role: 'club' }, status: 'pending' }), res);
      assert.equal(res.statusCode, 403);
      assert.equal(queried, false);
    } finally {
      User.findByPk = originalFindByPk;
      ClubMember.findAll = originalFindAll;
    }
  });

  it('lets a verified club inspect its own private membership requests', async () => {
    let options;
    User.findByPk = async () => ({ id: 8, role: 'club', adminVerified: true, bannedAt: null, deletedAt: null });
    ClubMember.findAll = async (query) => { options = query; return []; };
    try {
      const res = response();
      await handler(request({ user: { id: 8, role: 'club' }, status: 'pending' }), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(options.where, { clubId: 8, status: 'pending' });
    } finally {
      User.findByPk = originalFindByPk;
      ClubMember.findAll = originalFindAll;
    }
  });

  it('preserves public visibility of approved rosters for an unverified club', async () => {
    let options;
    User.findByPk = async () => ({ id: 8, role: 'club', adminVerified: false });
    ClubMember.findAll = async (query) => { options = query; return []; };
    try {
      const res = response();
      await handler(request({ user: { id: 8, role: 'club' } }), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(options.where, { clubId: 8, status: 'approved' });
    } finally {
      User.findByPk = originalFindByPk;
      ClubMember.findAll = originalFindAll;
    }
  });
});
