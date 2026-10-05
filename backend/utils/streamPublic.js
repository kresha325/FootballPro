const { playbackFor, currentStatus } = require('./streamLifecycle');

function ingestEnabled() {
  return process.env.RTMP_INGEST_ENABLED === 'true' && !!process.env.RTMP_SERVER_IP;
}

/**
 * Public stream payload. Stream keys and RTMP URLs stay on the owner
 * response only when native ingest is actually configured.
 */
function serializeStream(stream, { viewerId = null } = {}) {
  const raw = stream && typeof stream.toJSON === 'function' ? stream.toJSON() : { ...(stream || {}) };
  const owner = viewerId != null && Number(raw.streamerId) === Number(viewerId);
  const showIngest = owner && ingestEnabled();

  const out = { ...raw };
  if (!showIngest) {
    delete out.streamKey;
    delete out.rtmpUrl;
  }
  delete out.hlsUrl;

  out.status = currentStatus(out);
  out.provider = out.provider || (out.youtubeChannelId ? 'youtube' : 'livekit');
  out.providerId = out.providerId || null;
  out.recordingUrl = out.videoUrl || null;
  out.playback = playbackFor(out);
  out.ingestSupported = ingestEnabled();
  out.visibility = out.visibility || 'public';
  return out;
}

function canViewStream(stream, viewerId) {
  if (!stream) return false;
  const visibility = stream.visibility || 'public';
  if (visibility === 'public' || visibility === 'unlisted') return true;
  if (viewerId != null && Number(stream.streamerId) === Number(viewerId)) return true;
  return false;
}

module.exports = {
  ingestEnabled,
  serializeStream,
  canViewStream,
};
