/** Një avatar live për streamer — mbaj stream-in më të ri. */
export function dedupeLiveByStreamer(streams) {
  const byStreamer = new Map();

  for (const s of streams || []) {
    if (!s?.isLive) continue;
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
