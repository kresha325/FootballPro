'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Stream = require('../models/Stream');
const LiveStreamReplay = require('../models/LiveStreamReplay');
const replayController = require('../controllers/liveStreamReplay');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('private stream replay endpoints do not disclose replay URLs to unrelated or anonymous viewers', async () => {
  const originalStreamFind = Stream.findByPk;
  const originalReplayFind = LiveStreamReplay.findAll;
  let replayQueries = 0;
  Stream.findByPk = async () => ({ id: 12, streamerId: 44, visibility: 'private' });
  LiveStreamReplay.findAll = async () => { replayQueries += 1; return [{ videoUrl: 'https://res.cloudinary.com/test/video/authenticated/private/replay.mp4' }]; };
  try {
    for (const handler of [replayController.getReplays, replayController.getHighlights]) {
      const res = response();
      await handler({ params: { streamId: '12' } }, res);
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { error: 'Stream not found' });
    }
    assert.equal(replayQueries, 0);
  } finally {
    Stream.findByPk = originalStreamFind;
    LiveStreamReplay.findAll = originalReplayFind;
  }
});

test('public stream replay listings preserve anonymous visibility', async () => {
  const originalStreamFind = Stream.findByPk;
  const originalReplayFind = LiveStreamReplay.findAll;
  const rows = [{ id: 2, videoUrl: 'https://res.cloudinary.com/test/image/upload/public/thumb.jpg' }];
  Stream.findByPk = async () => ({ id: 13, streamerId: 44, visibility: 'public' });
  LiveStreamReplay.findAll = async () => rows;
  try {
    const res = response();
    await replayController.getReplays({ params: { streamId: '13' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, rows);
  } finally {
    Stream.findByPk = originalStreamFind;
    LiveStreamReplay.findAll = originalReplayFind;
  }
});
