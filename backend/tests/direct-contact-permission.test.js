'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkDirectContact } = require('../utils/directContactPermission');
const moderation = require('../controllers/moderation');
const VideoCall = require('../models/VideoCall');
const User = require('../models/User');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');
const videoCalls = require('../controllers/videoCalls');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('direct contact permission', () => {
  it('rejects invalid participants, explicit blocks, and block-service errors', async () => {
    assert.deepEqual(await checkDirectContact({ actorId: 5, targetId: 5, isEitherBlocked: async () => false }), {
      ok: false, status: 400, code: 'INVALID_PARTICIPANT',
    });
    assert.deepEqual(await checkDirectContact({ actorId: 5, targetId: 6, isEitherBlocked: async () => true }), {
      ok: false, status: 403, code: 'BLOCKED',
    });
    assert.deepEqual(await checkDirectContact({ actorId: 5, targetId: 6, isEitherBlocked: async () => { throw new Error('db down'); } }), {
      ok: false, status: 503, code: 'BLOCK_CHECK_UNAVAILABLE',
    });
  });

  it('does not create or notify a call when block verification is unavailable', async () => {
    const originalBlockCheck = moderation.isEitherBlocked;
    const originalFind = VideoCall.findOne;
    let callLookupReached = false;
    moderation.isEitherBlocked = async () => { throw new Error('db down'); };
    VideoCall.findOne = async () => { callLookupReached = true; return null; };
    try {
      const res = response();
      await videoCalls.createVideoCall({ user: { id: 5 }, body: { participantId: 6 } }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(callLookupReached, false);
    } finally {
      moderation.isEitherBlocked = originalBlockCheck;
      VideoCall.findOne = originalFind;
    }
  });

  it('does not allow an existing call to become connected after minor-contact consent is revoked', async () => {
    const originals = {
      block: moderation.isEitherBlocked,
      call: VideoCall.findByPk,
      user: User.findByPk,
      members: ClubMember.findAll,
      staff: ClubStaff.findAll,
      consents: GuardianConsent.findAll,
    };
    let saved = false;
    moderation.isEitherBlocked = async () => false;
    VideoCall.findByPk = async () => ({
      id: 25,
      callerId: 5,
      receiverId: 6,
      status: 'ringing',
      async save() { saved = true; },
    });
    User.findByPk = async (id) => Number(id) === 5
      ? { id: 5, role: 'coach', email: 'coach@example.test' }
      : { id: 6, role: 'athlete', email: 'athlete@example.test', dateOfBirth: '2012-04-03' };
    ClubMember.findAll = async () => [{ clubId: 7 }];
    ClubStaff.findAll = async () => [{ clubId: 7, staffId: 5, staffRole: 'head_coach', status: 'active' }];
    GuardianConsent.findAll = async () => [];
    try {
      const res = response();
      await videoCalls.updateCallStatus({ params: { callId: 25 }, body: { status: 'connected' }, user: { id: 5 } }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(saved, false);
    } finally {
      moderation.isEitherBlocked = originals.block;
      VideoCall.findByPk = originals.call;
      User.findByPk = originals.user;
      ClubMember.findAll = originals.members;
      ClubStaff.findAll = originals.staff;
      GuardianConsent.findAll = originals.consents;
    }
  });
});
