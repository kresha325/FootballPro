/**
 * YouTube VOD parser unit tests.
 * Run: node --test tests/youtubeVideo.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseYouTubeUrl,
  youtubeThumbnailUrl,
  youtubeEmbedUrl,
  isValidYouTubeVideoId,
} = require('../utils/youtubeVideo');

const SAMPLE_ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl', () => {
  it('parses watch URLs', () => {
    const r = parseYouTubeUrl(`https://www.youtube.com/watch?v=${SAMPLE_ID}`);
    assert.equal(r.ok, true);
    assert.equal(r.videoId, SAMPLE_ID);
    assert.equal(r.youtubeUrl, `https://www.youtube.com/watch?v=${SAMPLE_ID}`);
  });

  it('parses youtu.be short URLs', () => {
    const r = parseYouTubeUrl(`https://youtu.be/${SAMPLE_ID}`);
    assert.equal(r.ok, true);
    assert.equal(r.videoId, SAMPLE_ID);
  });

  it('parses shorts URLs', () => {
    const r = parseYouTubeUrl(`https://www.youtube.com/shorts/${SAMPLE_ID}`);
    assert.equal(r.ok, true);
    assert.equal(r.videoId, SAMPLE_ID);
  });

  it('parses embed URLs', () => {
    const r = parseYouTubeUrl(`https://www.youtube.com/embed/${SAMPLE_ID}`);
    assert.equal(r.ok, true);
    assert.equal(r.videoId, SAMPLE_ID);
  });

  it('rejects non-YouTube domains', () => {
    const r = parseYouTubeUrl('https://vimeo.com/123456');
    assert.equal(r.ok, false);
  });

  it('rejects malformed IDs', () => {
    const r = parseYouTubeUrl('https://www.youtube.com/watch?v=short');
    assert.equal(r.ok, false);
  });

  it('rejects empty input', () => {
    assert.equal(parseYouTubeUrl('').ok, false);
  });
});

describe('youtube helpers', () => {
  it('builds thumbnail and embed URLs', () => {
    assert.equal(
      youtubeThumbnailUrl(SAMPLE_ID),
      `https://img.youtube.com/vi/${SAMPLE_ID}/hqdefault.jpg`
    );
    assert.equal(
      youtubeEmbedUrl(SAMPLE_ID),
      `https://www.youtube-nocookie.com/embed/${SAMPLE_ID}`
    );
    assert.equal(isValidYouTubeVideoId(SAMPLE_ID), true);
    assert.equal(isValidYouTubeVideoId('bad'), false);
  });
});
