import { describe, it, expect } from 'vitest';
import { dedupeLiveByStreamer } from '../liveStreams';

describe('dedupeLiveByStreamer', () => {
  it('keeps only the newest live stream per streamer', () => {
    const streams = [
      { id: 1, streamerId: 10, isLive: true, updatedAt: '2026-01-01T10:00:00Z' },
      { id: 2, streamerId: 10, isLive: true, updatedAt: '2026-05-01T10:00:00Z' },
      { id: 3, streamerId: 20, isLive: true, updatedAt: '2026-05-02T10:00:00Z' },
      { id: 4, streamerId: 10, isLive: false, updatedAt: '2026-06-01T10:00:00Z' },
    ];

    const result = dedupeLiveByStreamer(streams);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual([2, 3]);
  });

  it('returns empty for no live streams', () => {
    expect(dedupeLiveByStreamer([{ id: 1, streamerId: 1, isLive: false }])).toEqual([]);
  });
});
