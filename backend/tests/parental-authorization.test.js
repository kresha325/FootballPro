'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  isMinorAthlete,
  hasActiveGuardianConsent,
  hasGuardianAuthorization,
  requiresParentalAuthorization,
  isAllowedWhilePending,
} = require('../utils/parentalAuthorization');
const GuardianConsent = require('../models/GuardianConsent');
const security = require('../utils/guardianConsentSecurity');
const { needsParentVerification } = require('../utils/userVerification');

const minor = { id: 900001, role: 'athlete', dateOfBirth: '2016-01-01', parentVerified: false };

describe('minor authorization policy', () => {
  it('classifies under-18 athletes as minors but leaves adults and organization roles unaffected', () => {
    assert.equal(needsParentVerification(minor), true, 'a 10-year-old athlete needs parental authorization');
    assert.equal(isMinorAthlete(minor), true);
    assert.equal(isMinorAthlete({ role: 'athlete', dateOfBirth: '1990-01-01' }), false);
    assert.equal(isMinorAthlete({ role: 'club', dateOfBirth: '2015-01-01' }), false);
    assert.equal(isMinorAthlete({ role: 'coach', dateOfBirth: '2015-01-01' }), false);
  });

  it('does not trust a legacy parentVerified boolean without an active consent record', async () => {
    const original = GuardianConsent.findOne;
    GuardianConsent.findOne = async () => null;
    try {
      assert.equal(await hasActiveGuardianConsent(minor.id), false);
      assert.equal(await requiresParentalAuthorization({ ...minor, parentVerified: true }), true);
    } finally { GuardianConsent.findOne = original; }
  });

  it('allows only a verified, unrevoked consent record to release the gate', async () => {
    const original = GuardianConsent.findOne;
    GuardianConsent.findOne = async () => ({ id: 4 });
    try {
      assert.equal(await hasActiveGuardianConsent(minor.id), true);
      assert.equal(await requiresParentalAuthorization({ ...minor, parentVerified: true }), false);
      assert.equal(await requiresParentalAuthorization({ ...minor, parentVerified: false }), true);
    } finally { GuardianConsent.findOne = original; }
  });

  it('hides pending minor profiles while preserving adult and organization visibility', () => {
    assert.equal(hasGuardianAuthorization(minor, false), false);
    assert.equal(hasGuardianAuthorization({ ...minor, parentVerified: true }, false), false);
    assert.equal(hasGuardianAuthorization({ ...minor, parentVerified: true }, true), true);
    assert.equal(hasGuardianAuthorization({ role: 'athlete', dateOfBirth: '1990-01-01' }, false), true);
    assert.equal(hasGuardianAuthorization({ role: 'club', dateOfBirth: '2015-01-01' }, false), true);
  });

  it('permits essential authorization operations and rejects protected feature routes', () => {
    assert.equal(isAllowedWhilePending('GET', '/auth/me'), true);
    assert.equal(isAllowedWhilePending('POST', '/verification/parent-request'), true);
    assert.equal(isAllowedWhilePending('POST', '/verification/parent-revoke-request'), false);
    assert.equal(isAllowedWhilePending('POST', '/auth/logout'), true);
    assert.equal(isAllowedWhilePending('GET', '/posts'), false);
    assert.equal(isAllowedWhilePending('POST', '/messages'), false);
    assert.equal(isAllowedWhilePending('POST', '/profiles/me'), false);
  });

  it('blocks an already-issued REST session before every protected operation', async () => {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const auth = require('../middleware/auth');
    const oldVerify = jwt.verify;
    const oldFindByPk = User.findByPk;
    const oldConsentFind = GuardianConsent.findOne;
    jwt.verify = () => ({ user: { id: minor.id, tv: 0 } });
    User.findByPk = async () => ({ ...minor, deletedAt: null, bannedAt: null, tokenVersion: 0 });
    GuardianConsent.findOne = async () => null;
    try {
      const res = {
        code: 200,
        data: null,
        status(code) { this.code = code; return this; },
        json(data) { this.data = data; return this; },
      };
      let passed = false;
      await auth({ method: 'POST', originalUrl: '/api/posts', header: () => 'Bearer old-session' }, res, () => { passed = true; });
      assert.equal(passed, false);
      assert.equal(res.code, 403);
      assert.equal(res.data.code, 'PARENTAL_AUTHORIZATION_REQUIRED');
    } finally {
      jwt.verify = oldVerify;
      User.findByPk = oldFindByPk;
      GuardianConsent.findOne = oldConsentFind;
    }
  });

  it('rejects a minor Socket.IO session at handshake', async () => {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const socketAuth = require('../middleware/socketAuth');
    const oldVerify = jwt.verify;
    const oldFindByPk = User.findByPk;
    const oldConsentFind = GuardianConsent.findOne;
    jwt.verify = () => ({ user: { id: minor.id, tv: 0 } });
    User.findByPk = async () => ({ ...minor, deletedAt: null, bannedAt: null, tokenVersion: 0 });
    GuardianConsent.findOne = async () => null;
    try {
      let socketError;
      await socketAuth({ handshake: { auth: { token: 'old-session' }, headers: {} }, data: {} }, (err) => { socketError = err; });
      assert.equal(socketError?.message, 'PARENTAL_AUTHORIZATION_REQUIRED');
    } finally {
      jwt.verify = oldVerify;
      User.findByPk = oldFindByPk;
      GuardianConsent.findOne = oldConsentFind;
    }
  });
});

describe('guardian token primitives', () => {
  it('creates high-entropy tokens and persists only a one-way hash', () => {
    const raw = security.createRawToken();
    assert.equal(raw.length, 64);
    assert.notEqual(security.hashToken(raw), raw);
    assert.equal(security.hashToken(raw), crypto.createHash('sha256').update(raw).digest('hex'));
  });

  it('treats missing, malformed, expired, and boundary-expired tokens as invalid', () => {
    assert.equal(security.isUnexpired(null), false);
    assert.equal(security.isUnexpired('not-a-date'), false);
    assert.equal(security.isUnexpired(new Date(999), 1000), false);
    assert.equal(security.isUnexpired(new Date(1001), 1000), true);
  });
});

describe('parent-confirm endpoint', () => {
  const emailService = require('../services/emailService');
  const User = require('../models/User');
  const ClubMember = require('../models/ClubMember');
  const sequelize = require('../config/database');
  const controller = require('../controllers/verification');

  function mockResponse() {
    return {
      statusCode: 200,
      body: '',
      headers: {},
      set(headers) { this.headers = headers; return this; },
      status(code) { this.statusCode = code; return this; },
      send(body) { this.body = body; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  it('rejects self-confirmation without an explicit guardian attestation', async () => {
    const token = 'test-guardian-token';
    const consent = { id: 72, minorUserId: minor.id, verificationTokenHash: security.hashToken(token), verificationTokenExpiresAt: new Date(Date.now() + 60000), verifiedAt: null, revokedAt: null };
    const user = { ...minor, firstName: 'Test', lastName: 'Athlete', parentVerified: false };
    const originalFindOne = GuardianConsent.findOne;
    const originalFindByPk = User.findByPk;
    const originalEmail = emailService.sendEmail;
    GuardianConsent.findOne = async () => consent;
    User.findByPk = async () => user;
    emailService.sendEmail = async () => ({ success: false });
    try {
      const res = mockResponse();
      await controller.parentConfirm({ body: { token }, query: {} }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(user.parentVerified, false);
      assert.equal(consent.verifiedAt, null);
    } finally {
      GuardianConsent.findOne = originalFindOne;
      User.findByPk = originalFindByPk;
      emailService.sendEmail = originalEmail;
    }
  });

  it('rejects expired verification tokens without changing consent state', async () => {
    const token = 'expired-guardian-token';
    const consent = { id: 73, minorUserId: minor.id, verificationTokenHash: security.hashToken(token), verificationTokenExpiresAt: new Date(Date.now() - 1000), verifiedAt: null, revokedAt: null };
    const originalFindOne = GuardianConsent.findOne;
    const originalFindByPk = User.findByPk;
    GuardianConsent.findOne = async () => consent;
    User.findByPk = async () => ({ ...minor });
    try {
      const res = mockResponse();
      await controller.parentConfirm({ body: { token, guardianName: 'Guardian Name', relationship: 'parent', attestGuardian: 'yes' }, query: {} }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(consent.verifiedAt, null);
    } finally {
      GuardianConsent.findOne = originalFindOne;
      User.findByPk = originalFindByPk;
    }
  });

  it('requires a distinct guardian email and never returns a confirmation URL to the athlete', async () => {
    const originalFindByPk = User.findByPk;
    User.findByPk = async () => ({ ...minor, email: 'child@example.test', parentVerified: false, save: async () => {} });
    try {
      const res = mockResponse();
      await controller.parentRequest({ user: { id: minor.id }, body: { parentEmail: 'CHILD@example.test' } }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(JSON.stringify(res.body).includes('confirmUrl'), false);
    } finally { User.findByPk = originalFindByPk; }
  });

  it('records guardian identity and scope only after the guardian form is submitted, then consumes the token', async () => {
    const token = 'valid-guardian-token';
    const now = Date.now();
    const consent = {
      id: 74, minorUserId: minor.id, guardianEmail: 'guardian@example.test',
      verificationTokenHash: security.hashToken(token), verificationTokenExpiresAt: new Date(now + 60000),
      managementTokenHash: null, verifiedAt: null, revokedAt: null,
      async save() {},
    };
    const user = { ...minor, email: 'child@example.test', firstName: 'Test', lastName: 'Athlete', parentVerified: false, async save() {} };
    const originals = {
      findOne: GuardianConsent.findOne,
      findByPk: User.findByPk,
      transaction: sequelize.transaction,
      sendEmail: emailService.sendEmail,
      clubMemberUpdate: ClubMember.update,
      clubMemberFindAll: ClubMember.findAll,
    };
    const oldEnv = Object.fromEntries(['RESEND_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_USER', 'EMAIL_PASSWORD'].map((key) => [key, process.env[key]]));
    for (const key of Object.keys(oldEnv)) process.env[key] = '';
    GuardianConsent.findOne = async () => consent;
    User.findByPk = async () => user;
    sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
    ClubMember.update = async () => [0];
    ClubMember.findAll = async () => [];
    try {
      const res = mockResponse();
      await controller.parentConfirm({ body: { token, guardianName: 'Adult Guardian', relationship: 'legal_guardian', attestGuardian: 'yes' }, query: {} }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(user.parentVerified, true);
      assert.equal(consent.guardianName, 'Adult Guardian');
      assert.equal(consent.relationship, 'legal_guardian');
      assert.equal(consent.verificationTokenHash, null);
      assert.equal(typeof consent.managementTokenHash, 'string');
      assert.equal(res.headers['Cache-Control'], 'no-store, private');

      const replay = mockResponse();
      await controller.parentConfirm({ body: { token, guardianName: 'Adult Guardian', relationship: 'parent', attestGuardian: 'yes' }, query: {} }, replay);
      assert.equal(replay.statusCode, 400);
    } finally {
      GuardianConsent.findOne = originals.findOne;
      User.findByPk = originals.findByPk;
      sequelize.transaction = originals.transaction;
      ClubMember.update = originals.clubMemberUpdate;
      ClubMember.findAll = originals.clubMemberFindAll;
      emailService.sendEmail = originals.sendEmail;
      for (const [key, value] of Object.entries(oldEnv)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('revokes consent, increments the session version and disconnects the child socket', async () => {
    const managementToken = 'management-token';
    const consent = {
      id: 75, minorUserId: minor.id,
      managementTokenHash: security.hashToken(managementToken),
      managementTokenExpiresAt: new Date(Date.now() + 60000), revokedAt: null,
      async save() {},
    };
    const user = { ...minor, tokenVersion: 3, async save() {} };
    const originals = {
      findOne: GuardianConsent.findOne,
      findByPk: User.findByPk,
      transaction: sequelize.transaction,
      clubMemberFindAll: ClubMember.findAll,
    };
    GuardianConsent.findOne = async () => consent;
    User.findByPk = async () => user;
    sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
    ClubMember.findAll = async () => [];
    let disconnected = '';
    try {
      const res = mockResponse();
      await controller.parentRevoke({
        body: { token: managementToken },
        app: { get: () => ({ in: (id) => ({ disconnectSockets: () => { disconnected = id; } }) }) },
      }, res);
      assert.equal(res.statusCode, 200);
      assert.ok(consent.revokedAt instanceof Date);
      assert.equal(user.parentVerified, false);
      assert.equal(user.tokenVersion, 4);
      assert.equal(disconnected, String(minor.id));
    } finally {
      GuardianConsent.findOne = originals.findOne;
      User.findByPk = originals.findByPk;
      sequelize.transaction = originals.transaction;
      ClubMember.findAll = originals.clubMemberFindAll;
    }
  });
});

describe('additive consent migration schema', () => {
  it('creates only the consent table and retains pending guardian fields as nullable', async () => {
    const migration = require('../migrations/20261030150000-create-guardian-consents');
    let capturedTable;
    const queryInterface = {
      async createTable(name, columns) { capturedTable = { name, columns }; },
      async addIndex() {},
    };
    const Sequelize = require('sequelize');
    await migration.up(queryInterface, Sequelize);
    assert.equal(capturedTable.name, 'GuardianConsents');
    assert.equal(capturedTable.columns.guardianName.allowNull, true);
    assert.equal(capturedTable.columns.relationship.allowNull, true);
    assert.equal(capturedTable.columns.minorUserId.allowNull, false);
  });
});
