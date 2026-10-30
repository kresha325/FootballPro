'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../utils/cloudinaryMediaDelivery');
const User = require('../models/User');
const GuardianConsent = require('../models/GuardianConsent');
const { requiresAuthenticatedDelivery } = require('../utils/restrictedMedia');
const Profile = require('../models/Profile');
const Gallery = require('../models/Gallery');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Stream = require('../models/Stream');
const LiveStreamReplay = require('../models/LiveStreamReplay');

test('only Cloudinary authenticated assets are signed; public and third-party media stay compatible', async () => {
  const client = { utils: { private_download_url: (id, format, options) => `signed:${id}.${format}:${options.expires_at}` } };
  const env = { ...process.env };
  process.env.CLOUDINARY_CLOUD_NAME = 'test';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  try {
    const source = {
      imageUrl: 'https://res.cloudinary.com/test/image/authenticated/v123/gallery/player/avatar.png',
      publicUrl: 'https://res.cloudinary.com/test/image/upload/v1/public/avatar.png',
      externalUrl: 'https://cdn.example.test/photo.png',
    };
    const result = await delivery.signMediaInPayload(source, { now: 1_000_000, client });
    assert.equal(result.signedCount, 1);
    assert.equal(result.payload.imageUrl, 'signed:gallery/player/avatar.png:1900');
    assert.equal(result.payload.publicUrl, source.publicUrl);
    assert.equal(result.payload.externalUrl, source.externalUrl);
    assert.equal(source.imageUrl.includes('/authenticated/'), true, 'input is not mutated');
  } finally {
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
  }
});

test('authenticated media signing fails closed without credentials', () => {
  const previous = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map((key) => process.env[key]);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  try {
    assert.throws(() => delivery.signAuthenticatedCloudinaryUrl(
      'https://res.cloudinary.com/test/video/authenticated/v1/private/replay.mp4'
    ), /not configured/);
  } finally {
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    });
  }
});

test('anonymous JSON responses never receive signed URLs for authenticated assets', async () => {
  const body = { videoUrl: 'https://res.cloudinary.com/test/video/authenticated/v1/private/clip.mp4' };
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return this; },
  };
  delivery.cloudinaryMediaDelivery({ user: null }, res, () => {
    res.json(body);
  });
  assert.equal(res.body.videoUrl, null);
  assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
});

test('legacy Cloudinary URLs can be mapped to authenticated delivery without changing public ids', () => {
  const url = 'https://res.cloudinary.com/test/image/upload/v123/gallery/player/avatar.png';
  assert.deepEqual(delivery.publicCloudinaryAsset(url), {
    resourceType: 'image', publicId: 'gallery/player/avatar', format: 'png',
  });
  assert.equal(delivery.authenticatedDeliveryUrl(url),
    'https://res.cloudinary.com/test/image/authenticated/v123/gallery/player/avatar.png');
  assert.equal(delivery.publicCloudinaryAsset('https://example.test/a.png'), null);
});

test('non-public uploads and underage athletes without consent require authenticated delivery', async () => {
  const oldFindUser = User.findByPk;
  const oldConsentFind = GuardianConsent.findOne;
  try {
    assert.equal(await requiresAuthenticatedDelivery(20, 'private'), true);
    User.findByPk = async () => ({ id: 20, role: 'athlete', dateOfBirth: '2012-03-01', parentVerified: false });
    GuardianConsent.findOne = async () => null;
    assert.equal(await requiresAuthenticatedDelivery(20, 'public'), true);
    User.findByPk = async () => ({ id: 21, role: 'athlete', dateOfBirth: '1990-03-01', parentVerified: false });
    assert.equal(await requiresAuthenticatedDelivery(21, 'public'), false);
    User.findByPk = async () => ({ id: 22, role: 'athlete', dateOfBirth: null, parentVerified: false });
    assert.equal(await requiresAuthenticatedDelivery(22, 'public'), true, 'unknown athlete age restricts media without changing legacy account gates');
    assert.equal(await requiresAuthenticatedDelivery(null, 'public'), false);
  } finally {
    User.findByPk = oldFindUser;
    GuardianConsent.findOne = oldConsentFind;
  }
});

test('withdrawal/deletion media cleanup converts unique legacy assets and invalidates CDN copies', async () => {
  const modelMethods = [Profile, Gallery, Video, Post, Stream, LiveStreamReplay].map((model) => [model, model.findAll]);
  const cloudinary = require('../utils/cloudinary');
  const originalRename = cloudinary.uploader.rename;
  const env = { ...process.env };
  process.env.CLOUDINARY_CLOUD_NAME = 'test';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  const profile = {
    id: 1, profilePhoto: 'https://res.cloudinary.com/test/image/upload/v1/people/a.png',
    coverPhoto: null, liveVideos: [], save: async () => {},
  };
  const gallery = {
    id: 2, imageUrl: profile.profilePhoto, videoUrl: null, visibility: 'public', save: async () => {},
  };
  const post = { id: 3, imageUrl: profile.profilePhoto, videoUrl: null, save: async () => {} };
  const renamed = [];
  try {
    [Profile, Gallery, Video, Post, Stream, LiveStreamReplay].forEach((model, index) => {
      model.findAll = async () => index === 0 ? [profile] : index === 1 ? [gallery] : index === 3 ? [post] : [];
    });
    cloudinary.uploader.rename = async (...args) => renamed.push(args);
    const { restrictUserCloudinaryMedia } = require('../services/restrictUserCloudinaryMedia');
    const result = await restrictUserCloudinaryMedia(77);
    assert.equal(result.secured, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(renamed.length, 1, 'duplicate database references convert the Cloudinary asset once');
    assert.equal(renamed[0][0], 'people/a');
    assert.equal(renamed[0][2].to_type, 'authenticated');
    assert.equal(renamed[0][2].invalidate, true);
    assert.equal(profile.profilePhoto.includes('/image/authenticated/'), true);
    assert.equal(gallery.imageUrl.includes('/image/authenticated/'), true);
    assert.equal(gallery.visibility, 'private');
    assert.equal(post.imageUrl, null, 'public feed records stop exposing withdrawn media before provider conversion');
  } finally {
    modelMethods.forEach(([model, method]) => { model.findAll = method; });
    cloudinary.uploader.rename = originalRename;
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
  }
});
