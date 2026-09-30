/**
 * MediaItems authorization helpers & category validation (no DB).
 * Run: node --test tests/mediaItems.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MediaItem = require('../models/MediaItem');
const MediaEvent = require('../models/MediaEvent');
const { parseYouTubeUrl } = require('../utils/youtubeVideo');

describe('MediaItem constants', () => {
  it('exposes expected categories and visibilities', () => {
    assert.ok(MediaItem.CATEGORIES.includes('match'));
    assert.ok(MediaItem.CATEGORIES.includes('match_highlight'));
    assert.ok(MediaItem.CATEGORIES.includes('goal'));
    assert.ok(MediaItem.VISIBILITIES.includes('public'));
    assert.ok(MediaItem.VISIBILITIES.includes('unlisted'));
    assert.ok(MediaItem.VISIBILITIES.includes('private'));
  });
});

describe('MediaEvent constants', () => {
  it('exposes analytics event types', () => {
    assert.deepEqual(MediaEvent.EVENT_TYPES, [
      'impression',
      'open',
      'page_open',
      'profile_click',
    ]);
  });
});

describe('create payload validation patterns', () => {
  it('normalizes YouTube URL before storage', () => {
    const parsed = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=30');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.youtubeUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(parsed.videoId.length, 11);
  });

  it('rejects arbitrary external URLs for media create', () => {
    const parsed = parseYouTubeUrl('https://evil.example/video.mp4');
    assert.equal(parsed.ok, false);
  });
});
