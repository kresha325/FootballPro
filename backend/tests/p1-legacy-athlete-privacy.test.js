'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const athleteController = require('../controllers/athlete');
const Athlete = require('../models/Profile');
const Follow = require('../models/Follow');
const GuardianConsent = require('../models/GuardianConsent');

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function profileFor(user, overrides = {}) {
  const row = {
    userId: user.id,
    bio: 'Player', city: 'Pristina', careerHistory: [{ club: 'FC' }],
    contact: { email: 'private@example.test', phone: '+000', agentName: 'Agent' },
    stats: { goals: 12, agentName: 'Private Agent' },
    privacy: { contact: 'public', email: 'private', phone: 'private', dateOfBirth: 'private', career: 'private', agent: 'private' },
    User: user,
    ...overrides,
  };
  return { get: () => ({ ...row, User: { ...user } }), User: user };
}

describe('legacy athlete profile privacy', () => {
  it('applies canonical privacy levels and never returns exact DOB or account fields', () => {
    const user = { id: 3, role: 'athlete', firstName: 'A', lastName: 'B', email: 'account@example.test', dateOfBirth: '2000-01-01', parentVerified: true };
    const output = athleteController.serializeLegacyAthleteProfile(profileFor(user), { id: 4, role: 'scout' }, { isFollower: false });
    assert.equal(output.contact.email, undefined);
    assert.equal(output.contact.phone, undefined);
    assert.equal(output.contact.agentName, undefined);
    assert.deepEqual(output.careerHistory, []);
    assert.equal(output.age, null);
    assert.equal(Object.hasOwn(output, 'dateOfBirth'), false);
    assert.equal(Object.hasOwn(output.User, 'email'), false);
    assert.equal(output.stats.goals, 12);
    assert.equal(output.stats.agentName, undefined);
  });

  it('allows a follower according to canonical visibility while preserving sports profile fields', () => {
    const user = { id: 3, role: 'athlete', firstName: 'A', lastName: 'B', dateOfBirth: '2000-01-01', parentVerified: true };
    const row = profileFor(user, { privacy: { contact: 'followers', email: 'followers', dateOfBirth: 'public', career: 'public', agent: 'followers' } });
    const output = athleteController.serializeLegacyAthleteProfile(row, { id: 4, role: 'athlete' }, { isFollower: true });
    assert.equal(output.bio, 'Player');
    assert.equal(output.contact.email, 'private@example.test');
    assert.equal(output.careerHistory.length, 1);
    assert.equal(output.age, null);
  });

  it('returns 404 for a minor without independently verified guardian authorization', async () => {
    const originals = { findOne: Athlete.findOne, consent: GuardianConsent.findOne };
    Athlete.findOne = async () => profileFor({ id: 3, role: 'athlete', firstName: 'A', lastName: 'B', dateOfBirth: '2015-01-01', parentVerified: false });
    GuardianConsent.findOne = async () => null;
    try {
      const response = res();
      await athleteController.getAthlete({ params: { id: '3' }, user: { id: 4, role: 'scout' } }, response);
      assert.equal(response.statusCode, 404);
    } finally { Athlete.findOne = originals.findOne; GuardianConsent.findOne = originals.consent; }
  });

  it('filters pending minors from the collection and keeps authorized athlete roster profiles', async () => {
    const originals = { findAll: Athlete.findAll, consents: GuardianConsent.findAll, follows: Follow.findAll };
    Athlete.findAll = async () => [
      profileFor({ id: 3, role: 'athlete', firstName: 'Pending', dateOfBirth: '2015-01-01', parentVerified: false }),
      profileFor({ id: 4, role: 'athlete', firstName: 'Authorized', dateOfBirth: '2015-01-01', parentVerified: true }),
    ];
    GuardianConsent.findAll = async () => [{ minorUserId: 4 }];
    Follow.findAll = async () => [];
    try {
      const response = res();
      await athleteController.getAllAthletes({ user: { id: 9, role: 'scout' } }, response);
      assert.deepEqual(response.body.map((row) => row.User.firstName), ['Authorized']);
    } finally { Athlete.findAll = originals.findAll; GuardianConsent.findAll = originals.consents; Follow.findAll = originals.follows; }
  });
});
