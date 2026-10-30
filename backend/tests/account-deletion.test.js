'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');
const Follow = require('../models/Follow');
const Block = require('../models/Block');
const Report = require('../models/Report');
const GuardianConsent = require('../models/GuardianConsent');
const { deleteMyAccount } = require('../controllers/accountDeletion');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('account deletion clears the actual profilePhoto field and revokes guardian consent', async () => {
  const originals = {
    findUser: User.findByPk,
    findProfile: Profile.findOne,
    notificationDestroy: Notification.destroy,
    followDestroy: Follow.destroy,
    blockDestroy: Block.destroy,
    reportDestroy: Report.destroy,
    guardianUpdate: GuardianConsent.update,
  };
  const user = {
    id: 71,
    email: 'athlete@example.test',
    password: 'oauth-only',
    tokenVersion: 2,
    save: async () => {},
  };
  let profilePatch;
  let guardianPatch;
  User.findByPk = async () => user;
  Profile.findOne = async () => ({ update: async (patch) => { profilePatch = patch; } });
  Notification.destroy = Follow.destroy = Block.destroy = Report.destroy = async () => 0;
  GuardianConsent.update = async (patch) => { guardianPatch = patch; };

  try {
    const res = response();
    await deleteMyAccount({ user: { id: 71 }, body: { confirm: 'DELETE' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(profilePatch.profilePhoto, null);
    assert.equal(profilePatch.coverPhoto, null);
    assert.equal(Object.hasOwn(profilePatch, 'profilePicture'), false);
    assert.ok(guardianPatch.revokedAt instanceof Date);
    assert.equal(guardianPatch.guardianEmail, 'deleted+71@xtalenti.invalid');
    assert.ok(user.deletedAt instanceof Date);
    assert.equal(user.tokenVersion, 3);
  } finally {
    User.findByPk = originals.findUser;
    Profile.findOne = originals.findProfile;
    Notification.destroy = originals.notificationDestroy;
    Follow.destroy = originals.followDestroy;
    Block.destroy = originals.blockDestroy;
    Report.destroy = originals.reportDestroy;
    GuardianConsent.update = originals.guardianUpdate;
  }
});
