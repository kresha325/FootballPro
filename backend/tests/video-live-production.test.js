/**
 * Stream lifecycle, public serialization, upload validation, highlight tags.
 * Run: node --test tests/video-live-production.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  applyStreamStatus,
  canTransition,
  deriveInitialStatus,
  currentStatus,
  STATUSES,
} = require('../utils/streamLifecycle');
const { serializeStream, canViewStream } = require('../utils/streamPublic');
const { assertVideoFile, rollbackUpload, MAX_VIDEO_BYTES } = require('../utils/videoUpload');
const { categoryForHighlightTag, normalizeHighlightTag, normalizeTags } = require('../utils/highlightTags');
const { streamEventCopy } = require('../utils/streamNotifications');

describe('stream lifecycle', () => {
  it('exposes the production statuses', () => {
    for (const status of ['scheduled', 'ready', 'live', 'ended', 'processing', 'available', 'cancelled', 'failed']) {
      assert.ok(STATUSES.includes(status));
    }
  });

  it('schedules a future stream and starts it', () => {
    const stream = { isLive: false };
    const status = deriveInitialStatus({ scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    assert.equal(status, 'scheduled');
    applyStreamStatus(stream, 'scheduled');
    applyStreamStatus(stream, 'live');
    assert.equal(stream.status, 'live');
    assert.equal(stream.isLive, true);
    assert.ok(stream.startedAt);
  });

  it('ends a live stream and publishes a replay', () => {
    const stream = { isLive: true, status: 'live', videoUrl: 'https://cdn.example/replay.mp4' };
    applyStreamStatus(stream, 'ended');
    applyStreamStatus(stream, 'processing');
    applyStreamStatus(stream, 'available');
    assert.equal(stream.status, 'available');
    assert.equal(stream.isLive, false);
    assert.equal(canTransition('available', 'live'), false);
  });

  it('rejects an unauthorized status jump', () => {
    const stream = { status: 'ready', isLive: false };
    assert.throws(() => applyStreamStatus(stream, 'available'), (err) => err.statusCode === 409);
  });

  it('treats legacy live rows as live', () => {
    assert.equal(currentStatus({ isLive: true }), 'live');
    assert.equal(currentStatus({ videoUrl: '/replay.mp4' }), 'available');
  });
});

describe('public stream payload', () => {
  it('strips stream keys unless native ingest is enabled for the owner', () => {
    delete process.env.RTMP_INGEST_ENABLED;
    const publicView = serializeStream({
      id: 4,
      streamerId: 9,
      title: 'Derby',
      streamKey: 'secret-key',
      rtmpUrl: 'rtmp://hidden/live',
      isLive: true,
      provider: 'livekit',
    }, { viewerId: 1 });
    assert.equal(publicView.streamKey, undefined);
    assert.equal(publicView.rtmpUrl, undefined);
    assert.equal(publicView.hlsUrl, undefined);
    assert.equal(publicView.playback, 'livekit');
    assert.equal(publicView.ingestSupported, false);

    const ownerView = serializeStream({
      id: 4,
      streamerId: 9,
      streamKey: 'secret-key',
      isLive: false,
      videoUrl: 'https://cdn.example/a.mp4',
    }, { viewerId: 9 });
    assert.equal(ownerView.streamKey, undefined);
    assert.equal(ownerView.recordingUrl, 'https://cdn.example/a.mp4');
  });

  it('hides private streams from other viewers', () => {
    assert.equal(canViewStream({ visibility: 'private', streamerId: 3 }, 9), false);
    assert.equal(canViewStream({ visibility: 'private', streamerId: 3 }, 3), true);
    assert.equal(canViewStream({ visibility: 'public', streamerId: 3 }, null), true);
  });
});

describe('video upload safety', () => {
  it('rejects a bad extension even when the mime looks like video', () => {
    assert.throws(
      () => assertVideoFile({ mimetype: 'video/mp4', originalname: 'clip.exe', size: 1000 }),
      (err) => err.statusCode === 400
    );
  });

  it('rejects files over the size limit', () => {
    assert.throws(
      () => assertVideoFile({ mimetype: 'video/mp4', originalname: 'clip.mp4', size: MAX_VIDEO_BYTES + 1 }),
      (err) => err.statusCode === 413
    );
  });

  it('removes a local file when the database write fails', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-video-'));
    const localPath = path.join(dir, 'clip.mp4');
    fs.writeFileSync(localPath, 'not-a-real-video');
    let destroyed = null;
    await rollbackUpload({
      localPath,
      publicId: 'videos/orphan',
      cloudinary: { uploader: { destroy: async (id) => { destroyed = id; } } },
    });
    assert.equal(destroyed, 'videos/orphan');
    assert.equal(fs.existsSync(localPath), false);
    fs.rmdirSync(dir);
  });
});

describe('highlights and notifications', () => {
  it('maps highlight tags onto categories without duplicating the provider id', () => {
    assert.equal(normalizeHighlightTag('goal'), 'GOAL');
    assert.equal(categoryForHighlightTag('ASSIST'), 'assist');
    assert.equal(categoryForHighlightTag('MATCH HIGHLIGHT'), 'match_highlight');
    assert.deepEqual(normalizeTags(['GOAL', 'GOAL', ' skill ']), ['GOAL', 'skill']);
  });

  it('prepares follower notifications through the existing system type', () => {
    const copy = streamEventCopy('replay_available', { id: 12, title: 'Final' });
    assert.equal(copy.link, '/live/12');
    assert.match(copy.message, /Final/);
    assert.equal(copy.event, 'replay_available');
  });
});
