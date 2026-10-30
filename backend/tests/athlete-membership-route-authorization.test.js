'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');
const User = require('../models/User');
const router = require('../routes/clubMembers');

const route = router.stack.find((layer) => layer.route?.path === '/athlete/:athleteId');
const handler = route.route.stack.at(-1).handle;
const memberships = [
  { id: 1, athleteId: 7, clubId: 10, status: 'approved' },
  { id: 2, athleteId: 7, clubId: 20, status: 'pending' },
  { id: 3, athleteId: 7, clubId: 30, status: 'rejected' },
];

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(user) {
  return { params: { athleteId: '7' }, user };
}

describe('athlete membership route authorization', () => {
  const originals = {
    findUser: User.findByPk,
    findUsers: User.findAll,
    findMemberships: ClubMember.findAll,
    findStaff: ClubStaff.findAll,
    findConsent: GuardianConsent.findOne,
  };

  function restore() {
    User.findByPk = originals.findUser;
    User.findAll = originals.findUsers;
    ClubMember.findAll = originals.findMemberships;
    ClubStaff.findAll = originals.findStaff;
    GuardianConsent.findOne = originals.findConsent;
  }

  function setup({ dateOfBirth = '2012-06-15', parentVerified = true, viewerRole = 'user', guardian = false, staff = [] } = {}) {
    User.findByPk = async () => ({ id: 7, role: 'athlete', dateOfBirth, parentVerified, deletedAt: null, bannedAt: null });
    ClubMember.findAll = async () => memberships;
    User.findAll = async () => [
      { id: 10, role: 'club', adminVerified: true },
      { id: 20, role: 'club', adminVerified: true },
      { id: 30, role: 'club', adminVerified: true },
    ];
    ClubStaff.findAll = async () => staff;
    GuardianConsent.findOne = async () => guardian ? { id: 100 } : null;
    return { id: guardian ? 42 : 55, role: viewerRole };
  }

  it('returns approved affiliations only to an unrelated viewer', async () => {
    const viewer = setup({ viewerRole: 'scout', guardian: false });
    try {
      const res = response();
      await handler(request(viewer), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.map((membership) => membership.id), [1]);
    } finally {
      restore();
    }
  });

  it('returns all membership states to a linked, verified guardian of a minor', async () => {
    const viewer = setup({ viewerRole: 'guardian', guardian: true });
    try {
      const res = response();
      await handler(request(viewer), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.map((membership) => membership.id), [1, 2, 3]);
    } finally {
      restore();
    }
  });

  it('limits an active coach to the assigned verified club membership', async () => {
    const viewer = setup({
      viewerRole: 'coach',
      staff: [{ clubId: 20, staffId: 55, staffRole: 'head_coach', status: 'active', leftAt: null }],
    });
    try {
      const res = response();
      await handler(request(viewer), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.map((membership) => membership.id), [2]);
    } finally {
      restore();
    }
  });

  it('keeps pending states hidden from a coach with an inactive assignment', async () => {
    const viewer = setup({
      viewerRole: 'coach',
      staff: [{ clubId: 20, staffId: 55, staffRole: 'head_coach', status: 'inactive', leftAt: null }],
    });
    try {
      const res = response();
      await handler(request(viewer), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.map((membership) => membership.id), [1]);
    } finally {
      restore();
    }
  });
});
