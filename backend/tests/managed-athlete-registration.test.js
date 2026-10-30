'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('../controllers/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');
const ClubMember = require('../models/ClubMember');
const managedAthletes = require('../controllers/managedAthletes');
const sequelize = require('../config/database');
const emailService = require('../services/emailService');
const {
  validateManagedAthleteInput,
  isActiveCoachAssignment,
  isVerifiedClub,
  canAdminRegisterAthlete,
} = require('../utils/managedAthleteRegistration');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withCreateMocks({ minor = false, duplicate = null, emailSent = true } = {}, run) {
  const originals = {
    transaction: sequelize.transaction,
    dialect: sequelize.getDialect,
    query: sequelize.query,
    userFindByPk: User.findByPk,
    userFindOne: User.findOne,
    userCreate: User.create,
    profileFindOne: Profile.findOne,
    profileCreate: Profile.create,
    memberFindOne: ClubMember.findOne,
    memberCreate: ClubMember.create,
    consentUpdate: GuardianConsent.update,
    consentCreate: GuardianConsent.create,
    sendEmail: emailService.sendEmail,
  };
  const created = { users: [], profiles: [], members: [], consents: [], emailArgs: null };
  const createdUser = {
    id: 401,
    getAge() { return minor ? 11 : 23; },
    getAgeGroup() { return minor ? 'u13' : 'senior'; },
    async save() {},
  };
  sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
  sequelize.getDialect = () => 'sqlite';
  sequelize.query = async () => [];
  User.findByPk = async (id) => ({ id, role: 'club', adminVerified: true, language: 'sq', firstName: 'Club', lastName: 'Test' });
  User.findOne = async () => duplicate;
  User.create = async (payload) => {
    created.users.push(payload);
    Object.assign(createdUser, payload);
    return createdUser;
  };
  Profile.findOne = async () => ({ club: 'Test Club' });
  Profile.create = async (payload) => { created.profiles.push(payload); return { ...payload }; };
  ClubMember.findOne = async () => null;
  ClubMember.create = async (payload) => { created.members.push(payload); return { id: 402, ...payload }; };
  GuardianConsent.update = async () => [0];
  GuardianConsent.create = async (payload) => { created.consents.push(payload); return payload; };
  emailService.sendEmail = async (...args) => { created.emailArgs = args; return { success: emailSent }; };
  try { await run(created); }
  finally {
    sequelize.transaction = originals.transaction;
    sequelize.getDialect = originals.dialect;
    sequelize.query = originals.query;
    User.findByPk = originals.userFindByPk;
    User.findOne = originals.userFindOne;
    User.create = originals.userCreate;
    Profile.findOne = originals.profileFindOne;
    Profile.create = originals.profileCreate;
    ClubMember.findOne = originals.memberFindOne;
    ClubMember.create = originals.memberCreate;
    GuardianConsent.update = originals.consentUpdate;
    GuardianConsent.create = originals.consentCreate;
    emailService.sendEmail = originals.sendEmail;
  }
}

describe('managed athlete registration policy', () => {
  it('rejects public athlete signup before any database lookup', async () => {
    const original = User.findOne;
    let queried = false;
    User.findOne = async () => { queried = true; throw new Error('unexpected database access'); };
    try {
      const res = response();
      await register({ body: { email: 'athlete@example.com', password: 'SafePassword!26', firstName: 'Arta', lastName: 'Test', role: 'athlete' } }, res);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.msg, /klubi ose administratori/i);
      assert.equal(queried, false);
    } finally { User.findOne = original; }
  });

  it('does not silently default a missing public registration role to athlete', async () => {
    const original = User.findOne;
    let queried = false;
    User.findOne = async () => { queried = true; throw new Error('unexpected database access'); };
    try {
      const res = response();
      await register({ body: { email: 'no-role@example.com', password: 'SafePassword!26', firstName: 'Arta', lastName: 'Test' } }, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.msg, /llojin e llogarisë/i);
      assert.equal(queried, false);
    } finally { User.findOne = original; }
  });

  it('accepts only valid athlete fields and requires a guardian contact for minors', () => {
    const minor = validateManagedAthleteInput({
      firstName: '  Arta  ', lastName: 'Test', dateOfBirth: '2015-05-12',
      competitionCategory: 'u13', squadGroup: 'B',
    });
    assert.equal(minor.ok, false);
    assert.match(minor.message, /kujdestarit/i);

    const valid = validateManagedAthleteInput({
      firstName: '  Arta  ', lastName: ' Test ', dateOfBirth: '2015-05-12',
      parentEmail: ' GUARDIAN@example.com ', competitionCategory: 'u13', squadGroup: 'b',
      position: 'Goalkeeper', jerseyNumber: '1',
    });
    assert.equal(valid.ok, true);
    assert.equal(valid.value.firstName, 'Arta');
    assert.equal(valid.value.squadGroup, 'B');
    assert.equal(valid.value.parentEmail, 'guardian@example.com');
    assert.equal(validateManagedAthleteInput({ firstName: 'A', lastName: 'B', dateOfBirth: '2015-01-01', parentEmail: 'x@y.com', competitionCategory: 'u13', squadGroup: 'D' }).ok, false);
  });

  it('requires the assigned coach identity, club, active state, coaching role, and unexpired contract', () => {
    const actor = { id: 21, role: 'coach' };
    const assignment = { clubId: 8, staffId: 21, status: 'active', staffRole: 'head_coach', contractUntil: '2027-01-01' };
    assert.equal(isActiveCoachAssignment(actor, assignment, 8, new Date('2026-10-30')), true);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, clubId: 9 }, 8), false);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, staffId: 22 }, 8), false);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, status: 'pending' }, 8), false);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, leftAt: new Date() }, 8), false);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, staffRole: 'physiotherapist' }, 8), false);
    assert.equal(isActiveCoachAssignment(actor, { ...assignment, contractUntil: '2026-01-01' }, 8, new Date('2026-10-30')), false);
    assert.equal(isActiveCoachAssignment({ ...actor, role: 'athlete' }, assignment, 8), false);
  });

  it('requires the club administrative verification flag and checks admin permissions', () => {
    assert.equal(isVerifiedClub({ role: 'club', adminVerified: true }), true);
    assert.equal(isVerifiedClub({ role: 'club', adminVerified: false }), false);
    assert.equal(isVerifiedClub({ role: 'club', adminVerified: true, bannedAt: new Date() }), false);
    assert.equal(canAdminRegisterAthlete({ role: 'admin', adminRole: 'admin' }), true);
    assert.equal(canAdminRegisterAthlete({ role: 'admin', adminRole: 'support' }), false);
    assert.equal(canAdminRegisterAthlete({ role: 'coach' }), false);
  });

  it('authorizes a club only for itself and checks the club verification state in the database', async () => {
    const original = User.findByPk;
    User.findByPk = async (id) => ({ id, role: 'club', adminVerified: Number(id) === 8, firstName: 'Club' });
    try {
      const own = await managedAthletes.getAuthorizedClub({ id: 8, role: 'club' }, undefined);
      assert.equal(own.club.id, 8);
      const other = await managedAthletes.getAuthorizedClub({ id: 8, role: 'club' }, 9);
      assert.equal(other.error.status, 403);
      const unverified = await managedAthletes.getAuthorizedClub({ id: 9, role: 'club' }, undefined);
      assert.equal(unverified.error.status, 403);
    } finally { User.findByPk = original; }
  });

  it('checks active staff assignment before allowing a coach to target a club', async () => {
    const originals = { findAll: ClubStaff.findAll, findByPk: User.findByPk };
    ClubStaff.findAll = async ({ where }) => where.clubId === 8 && where.staffId === 21
      ? [{ clubId: 8, staffId: 21, status: 'active', staffRole: 'head_coach', contractUntil: '2027-01-01' }]
      : [];
    User.findByPk = async (id) => ({ id, role: 'club', adminVerified: true, firstName: 'Club' });
    try {
      assert.equal((await managedAthletes.getAuthorizedClub({ id: 21, role: 'coach' }, 8)).club.id, 8);
      assert.equal((await managedAthletes.getAuthorizedClub({ id: 21, role: 'coach' }, 9)).error.status, 403);
    } finally {
      ClubStaff.findAll = originals.findAll;
      User.findByPk = originals.findByPk;
    }
  });

  it('creates adult records transactionally without returning password or activation secrets', async () => {
    await withCreateMocks({}, async (created) => {
      const res = response();
      await managedAthletes.createManagedAthlete({
        user: { id: 8, role: 'club' },
        body: { firstName: 'Adult', lastName: 'Athlete', dateOfBirth: '2000-01-01', position: 'Forward', jerseyNumber: '9' },
      }, res);
      assert.equal(res.statusCode, 201);
      assert.equal(created.users[0].role, 'athlete');
      assert.equal(created.users[0].email.endsWith('@athlete.invalid'), true);
      assert.notEqual(created.users[0].password, undefined);
      assert.equal(created.users[0].password.startsWith('$2'), true);
      assert.equal(created.profiles.length, 1);
      assert.equal(created.members[0].status, 'approved');
      assert.equal(created.members[0].createdByUserId, 8);
      assert.equal(created.members[0].creationSource, 'club_managed_registration');
      assert.equal(res.body.parentAuthorizationPending, false);
      assert.equal(JSON.stringify(res.body).includes('password'), false);
      assert.equal(JSON.stringify(res.body).includes('token'), false);
    });
  });

  it('keeps a minor pending and stores only a hashed guardian token', async () => {
    await withCreateMocks({ minor: true }, async (created) => {
      const res = response();
      await managedAthletes.createManagedAthlete({
        user: { id: 8, role: 'club' },
        body: { firstName: 'Minor', lastName: 'Athlete', dateOfBirth: '2015-01-01', parentEmail: 'guardian@example.com', competitionCategory: 'u13', squadGroup: 'A' },
      }, res);
      assert.equal(res.statusCode, 201);
      assert.equal(created.users[0].parentVerified, false);
      assert.equal(created.users[0].verified, false);
      assert.equal(created.members[0].status, 'pending');
      assert.equal(res.body.parentAuthorizationPending, true);
      assert.equal(res.body.guardianEmailSent, false);
      assert.equal(created.consents.length, 1);
      assert.equal(created.consents[0].guardianEmail, 'guardian@example.com');
      assert.equal(created.consents[0].verificationTokenHash.length, 64);
      assert.match(created.consents[0].verificationTokenHash, /^[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(res.body).includes(created.consents[0].verificationTokenHash), false);
    });
  });

  it('rejects a duplicate athlete identity before creating a second profile', async () => {
    await withCreateMocks({ duplicate: { id: 402 } }, async (created) => {
      const res = response();
      await managedAthletes.createManagedAthlete({
        user: { id: 8, role: 'club' },
        body: { firstName: 'Existing', lastName: 'Athlete', dateOfBirth: '2000-01-01' },
      }, res);
      assert.equal(res.statusCode, 409);
      assert.equal(created.users.length, 0);
      assert.equal(created.profiles.length, 0);
      assert.equal(created.members.length, 0);
    });
  });

  it('does not let club membership approval replace missing guardian authorization', async () => {
    const router = require('../routes/clubMembers');
    const layer = router.stack.find((item) => item.route?.path === '/:membershipId/status' && item.route.methods.put);
    const handler = layer.route.stack.at(-1).handle;
    const originals = {
      member: ClubMember.findByPk,
      user: User.findByPk,
      consent: GuardianConsent.findOne,
    };
    let saved = false;
    ClubMember.findByPk = async () => ({
      clubId: 8, athleteId: 41, creationSource: 'club_managed_registration',
      async save() { saved = true; },
    });
    User.findByPk = async () => ({ id: 41, role: 'athlete', dateOfBirth: '2015-01-01', parentVerified: false });
    GuardianConsent.findOne = async () => null;
    try {
      const res = response();
      await handler({ params: { membershipId: '7' }, body: { status: 'approved' }, user: { id: 8, role: 'club' } }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'PARENTAL_AUTHORIZATION_REQUIRED');
      assert.equal(saved, false);
    } finally {
      ClubMember.findByPk = originals.member;
      User.findByPk = originals.user;
      GuardianConsent.findOne = originals.consent;
    }
  });

  it('blocks OAuth from creating a new account while retaining existing-account sign-in/linking', async () => {
    const passport = require('../config/passport');
    const originalFindOne = User.findOne;
    const originalCreate = User.create;
    let createCalled = false;
    User.findOne = async () => null;
    User.create = async () => { createCalled = true; throw new Error('new users must not be created via OAuth'); };
    try {
      await assert.rejects(
        passport.upsertOAuthUser('googleId', 'new-oauth-user', 'new@example.com', 'New', 'User'),
        /Public athlete registration is disabled/,
      );
      assert.equal(createCalled, false);
    } finally {
      User.findOne = originalFindOne;
      User.create = originalCreate;
    }
  });
});
