'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Profile = require('../models/Profile');
const playerProfileCv = require('../utils/playerProfileCv');
const { filterByProfileVideoPrivacy } = require('../controllers/videos');

test('video collections honor profile videos visibility while preserving owner access', async () => {
  const oldFindAll = Profile.findAll;
  const oldViewerAccess = playerProfileCv.viewerAccess;
  try {
    Profile.findAll = async () => [{ userId: 45, privacy: { videos: 'private' } }];
    playerProfileCv.viewerAccess = async () => ({ isOwner: false, isFollower: false, isProfessional: false });
    const videos = [{ id: 1, userId: 45, visibility: 'public' }];
    assert.deepEqual(await filterByProfileVideoPrivacy(videos, { user: { id: 99, role: 'athlete' } }), []);
    assert.deepEqual(await filterByProfileVideoPrivacy(videos, { user: { id: 45, role: 'athlete' } }), videos);
    assert.deepEqual(await filterByProfileVideoPrivacy(videos, { user: { id: 99, role: 'admin' } }), videos);
  } finally {
    Profile.findAll = oldFindAll;
    playerProfileCv.viewerAccess = oldViewerAccess;
  }
});
