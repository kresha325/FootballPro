/** Një avatar live për streamer — mbaj stream-in më të ri. */
const STALE_MS = 15 * 60 * 1000;

export function isLikelyStaleStream(stream) {
  if (!stream?.isLive) return true;
  const updated = stream.updatedAt || stream.createdAt;
  if (!updated) return false;
  return Date.now() - new Date(updated).getTime() > STALE_MS;
}

export function dedupeLiveByStreamer(streams) {
  const byStreamer = new Map();

  for (const s of streams || []) {
    if (!s?.isLive || isLikelyStaleStream(s)) continue;
    const streamerId = s.streamerId ?? s.streamer?.id;
    if (!streamerId) continue;

    const prev = byStreamer.get(streamerId);
    if (!prev) {
      byStreamer.set(streamerId, s);
      continue;
    }

    const prevAt = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
    const nextAt = new Date(s.updatedAt || s.createdAt || 0).getTime();
    if (nextAt > prevAt || (nextAt === prevAt && (s.id || 0) > (prev.id || 0))) {
      byStreamer.set(streamerId, s);
    }
  }

  return [...byStreamer.values()].sort((a, b) => {
    const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bT - aT;
  });
}
