import { describe, it, expect } from 'vitest';
import { dedupeLiveByStreamer } from '../liveStreams';

describe('dedupeLiveByStreamer', () => {
  it('keeps only the newest live stream per streamer', () => {
    const now = Date.now();
    const iso = (offsetMs) => new Date(now - offsetMs).toISOString();
    const streams = [
      { id: 1, streamerId: 10, isLive: true, updatedAt: iso(60_000) },
      { id: 2, streamerId: 10, isLive: true, updatedAt: iso(30_000) },
      { id: 3, streamerId: 20, isLive: true, updatedAt: iso(20_000) },
      { id: 4, streamerId: 10, isLive: false, updatedAt: iso(5_000) },
    ];

    const result = dedupeLiveByStreamer(streams);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual([2, 3]);
  });

  it('returns empty for no live streams', () => {
    expect(dedupeLiveByStreamer([{ id: 1, streamerId: 1, isLive: false }])).toEqual([]);
  });
});
