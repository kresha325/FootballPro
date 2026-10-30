'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CHANNELS,
  authorizeMinorDirectContact,
  authorizeMinorGroupCommunication,
} = require('../utils/minorCommunicationPolicy');

const minor = {
  id: 10,
  role: 'athlete',
  email: 'player@example.test',
  dateOfBirth: '2012-04-03',
};
const coach = { id: 20, role: 'coach', email: 'coach@example.test' };
const guardian = {
  id: 30,
  role: 'individual',
  email: 'parent@example.test',
};
const club = { id: 40, role: 'club', adminVerified: true };

function policyFixture({ consents = [], membership = true, assignment = true } = {}) {
  const users = [minor, coach, guardian, club];
  return {
    User: {
      async findByPk(id) {
        return users.find((user) => Number(user.id) === Number(id)) || null;
      },
      async findAll({ where }) {
        return users.filter((user) => where.id.includes(Number(user.id)));
      },
    },
    ClubMember: {
      async findAll() {
        return membership ? [{ clubId: club.id }] : [];
      },
    },
    ClubStaff: {
      async findAll() {
        return assignment ? [{ clubId: club.id, staffId: coach.id, staffRole: 'head_coach', status: 'active' }] : [];
      },
    },
    GuardianConsent: {
      async findAll({ where }) {
        return consents.filter((row) => row.minorUserId === where.minorUserId &&
          row.consentPurpose === where.consentPurpose && row.verifiedAt && !row.revokedAt);
      },
    },
  };
}

function accountConsent() {
  return {
    minorUserId: minor.id,
    guardianEmail: guardian.email,
    guardianName: 'Parent Name',
    relationship: 'parent',
    consentPurpose: 'minor_account_authorization',
    consentScope: ['account_access', 'sports_profile'],
    verifiedAt: new Date(),
    revokedAt: null,
  };
}

function communicationConsent(channel, { adultUserId = coach.id, clubId = club.id, revokedAt = null } = {}) {
  return {
    minorUserId: minor.id,
    consentPurpose: 'minor_communication',
    consentScope: { adultUserId, clubId, channels: [channel] },
    verifiedAt: new Date(),
    revokedAt,
  };
}

describe('minor communication policy', () => {
  it('fails closed for athlete accounts with missing or invalid birth dates', async () => {
    const fixture = policyFixture({ consents: [] });
    const users = [
      { id: 11, role: 'athlete', email: 'unknown-age@example.test', dateOfBirth: null },
      { id: 12, role: 'athlete', email: 'invalid-age@example.test', dateOfBirth: 'not-a-date' },
    ];
    for (const unknownAgeAthlete of users) {
      fixture.User.findByPk = async (id) => Number(id) === coach.id ? coach :
        Number(id) === unknownAgeAthlete.id ? unknownAgeAthlete : null;
      const result = await authorizeMinorDirectContact({
        actorId: coach.id,
        targetId: unknownAgeAthlete.id,
        channel: CHANNELS.DIRECT_MESSAGE,
        ...fixture,
      });
      assert.equal(result.allowed, false);
    }
  });

  it('denies unrelated adults by default and does not infer contact consent from account consent', async () => {
    const fixture = policyFixture({ consents: [accountConsent()] });
    const result = await authorizeMinorDirectContact({
      actorId: coach.id,
      targetId: minor.id,
      channel: CHANNELS.DIRECT_MESSAGE,
      ...fixture,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it('allows an assigned coach only for the specifically consented channel and club', async () => {
    const fixture = policyFixture({ consents: [accountConsent(), communicationConsent(CHANNELS.DIRECT_MESSAGE)] });
    const allowed = await authorizeMinorDirectContact({
      actorId: coach.id,
      targetId: minor.id,
      channel: CHANNELS.DIRECT_MESSAGE,
      ...fixture,
    });
    const deniedOtherChannel = await authorizeMinorDirectContact({
      actorId: coach.id,
      targetId: minor.id,
      channel: CHANNELS.VIDEO_CALL,
      ...fixture,
    });
    assert.equal(allowed.allowed, true);
    assert.equal(deniedOtherChannel.allowed, false);
  });

  it('denies coach contact when roster membership or active staff assignment is absent', async () => {
    for (const fixture of [
      policyFixture({ consents: [communicationConsent(CHANNELS.DIRECT_MESSAGE)], membership: false }),
      policyFixture({ consents: [communicationConsent(CHANNELS.DIRECT_MESSAGE)], assignment: false }),
    ]) {
      const result = await authorizeMinorDirectContact({
        actorId: coach.id,
        targetId: minor.id,
        channel: CHANNELS.DIRECT_MESSAGE,
        ...fixture,
      });
      assert.equal(result.allowed, false);
    }
  });

  it('allows the verified guardian, and revoking base guardian consent removes that authorization', async () => {
    const active = policyFixture({ consents: [accountConsent()] });
    const allowed = await authorizeMinorDirectContact({
      actorId: guardian.id,
      targetId: minor.id,
      channel: CHANNELS.DIRECT_MESSAGE,
      ...active,
    });
    assert.equal(allowed.allowed, true);

    const revoked = policyFixture({ consents: [{ ...accountConsent(), revokedAt: new Date() }] });
    const denied = await authorizeMinorDirectContact({
      actorId: guardian.id,
      targetId: minor.id,
      channel: CHANNELS.DIRECT_MESSAGE,
      ...revoked,
    });
    assert.equal(denied.allowed, false);
  });

  it('permits guardian-mediated groups only with guardian present and an exact adult grant', async () => {
    const adult = { id: 21, role: 'scout', email: 'scout@example.test', adminVerified: true };
    const fixture = policyFixture({ consents: [accountConsent()] });
    fixture.User.findAll = async ({ where }) => [minor, guardian, adult].filter((user) => where.id.includes(user.id));
    fixture.GuardianConsent.findAll = async ({ where }) => {
      const rows = [
        accountConsent(),
        {
          minorUserId: minor.id,
          consentPurpose: 'minor_communication',
          consentScope: { adultUserId: adult.id, channels: [CHANNELS.GUARDIAN_MEDIATED_GROUP] },
          verifiedAt: new Date(),
          revokedAt: null,
        },
      ];
      return rows.filter((row) => row.minorUserId === where.minorUserId && row.consentPurpose === where.consentPurpose && row.verifiedAt && !row.revokedAt);
    };
    const allowed = await authorizeMinorGroupCommunication({
      actorId: adult.id,
      memberIds: [minor.id, guardian.id, adult.id],
      User: fixture.User,
      ClubMember: fixture.ClubMember,
      ClubStaff: fixture.ClubStaff,
      GuardianConsent: fixture.GuardianConsent,
    });
    const deniedWithoutGuardian = await authorizeMinorGroupCommunication({
      actorId: adult.id,
      memberIds: [minor.id, adult.id],
      User: fixture.User,
      ClubMember: fixture.ClubMember,
      ClubStaff: fixture.ClubStaff,
      GuardianConsent: fixture.GuardianConsent,
    });
    assert.equal(allowed.allowed, true);
    assert.equal(deniedWithoutGuardian.allowed, false);
  });

  it('does not let mediation bypass an expired coach assignment or professional verification', async () => {
    const coachFixture = policyFixture({
      consents: [accountConsent(), communicationConsent(CHANNELS.GUARDIAN_MEDIATED_GROUP)],
      assignment: false,
    });
    const coachGroupUsers = [minor, guardian, coach];
    coachFixture.User.findAll = async ({ where }) => coachGroupUsers.filter((user) => where.id.includes(user.id));
    const inactiveCoach = await authorizeMinorGroupCommunication({
      actorId: coach.id,
      memberIds: [minor.id, guardian.id, coach.id],
      ...coachFixture,
    });

    const scout = { id: 21, role: 'scout', email: 'scout@example.test', adminVerified: false };
    const scoutFixture = policyFixture({ consents: [accountConsent()] });
    scoutFixture.User.findAll = async ({ where }) => [minor, guardian, scout].filter((user) => where.id.includes(user.id));
    scoutFixture.GuardianConsent.findAll = async ({ where }) => [
      accountConsent(),
      {
        minorUserId: minor.id,
        consentPurpose: 'minor_communication',
        consentScope: { adultUserId: scout.id, channels: [CHANNELS.GUARDIAN_MEDIATED_GROUP] },
        verifiedAt: new Date(),
        revokedAt: null,
      },
    ].filter((row) => row.minorUserId === where.minorUserId && row.consentPurpose === where.consentPurpose);
    const unverifiedScout = await authorizeMinorGroupCommunication({
      actorId: scout.id,
      memberIds: [minor.id, guardian.id, scout.id],
      ...scoutFixture,
    });
    assert.equal(inactiveCoach.allowed, false);
    assert.equal(unverifiedScout.allowed, false);
  });
});
