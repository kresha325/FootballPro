const STATUSES = [
  'scheduled',
  'ready',
  'live',
  'ended',
  'processing',
  'available',
  'cancelled',
  'failed',
];

const TRANSITIONS = {
  scheduled: new Set(['ready', 'live', 'cancelled', 'failed']),
  ready: new Set(['scheduled', 'live', 'cancelled', 'failed']),
  live: new Set(['ended', 'failed']),
  ended: new Set(['processing', 'available', 'failed']),
  processing: new Set(['available', 'failed']),
  available: new Set([]),
  cancelled: new Set([]),
  failed: new Set(['ready', 'scheduled']),
};

function isStatus(value) {
  return STATUSES.includes(value);
}

function currentStatus(stream) {
  if (stream && isStatus(stream.status)) return stream.status;
  if (stream?.isLive) return 'live';
  if (stream?.videoUrl) return 'available';
  return 'ready';
}

function canTransition(from, to) {
  if (from === to) return true;
  const allowed = TRANSITIONS[from];
  return !!allowed && allowed.has(to);
}

function deriveInitialStatus({ scheduledAt } = {}) {
  if (!scheduledAt) return 'ready';
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return null;
  if (when.getTime() > Date.now() + 5000) return 'scheduled';
  return 'ready';
}

function statusError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Mutates a Stream instance (or plain object) and keeps isLive in sync.
 */
function applyStreamStatus(stream, nextStatus, extra = {}) {
  if (!isStatus(nextStatus)) {
    throw statusError('Invalid stream status', 400);
  }
  const from = currentStatus(stream);
  if (!canTransition(from, nextStatus)) {
    throw statusError(`Cannot move stream from ${from} to ${nextStatus}`, 409);
  }

  stream.status = nextStatus;
  stream.isLive = nextStatus === 'live';

  if (nextStatus === 'live') {
    stream.startedAt = stream.startedAt || new Date();
    stream.endedAt = null;
  }
  if (nextStatus === 'ended' || nextStatus === 'failed' || nextStatus === 'cancelled') {
    stream.viewers = 0;
    if (nextStatus !== 'cancelled') {
      stream.endedAt = stream.endedAt || new Date();
    }
  }
  if (nextStatus === 'scheduled' && extra.scheduledAt) {
    stream.scheduledAt = extra.scheduledAt;
  }

  const reserved = new Set(['status', 'isLive', 'startedAt', 'endedAt', 'viewers']);
  Object.keys(extra).forEach((key) => {
    if (!reserved.has(key) && extra[key] !== undefined) stream[key] = extra[key];
  });

  return stream;
}

function playbackFor(stream) {
  const status = currentStatus(stream);
  if (status === 'live') {
    if (stream?.provider === 'youtube' && stream?.youtubeChannelId) return 'youtube_live';
    return 'livekit';
  }
  if (status === 'available' || (status === 'ended' && stream?.videoUrl)) return 'replay';
  if (status === 'processing') return 'processing';
  if (status === 'scheduled' || status === 'ready') return 'upcoming';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'failed';
  return 'unavailable';
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  isStatus,
  currentStatus,
  canTransition,
  deriveInitialStatus,
  applyStreamStatus,
  playbackFor,
};
