'use strict';

/**
 * Normalizon ID-në e kanalit YouTube (formë UC + 22 karaktere).
 * Pranon edhe URL me .../channel/UC...
 */
function normalizeYoutubeChannelId(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let id = s;
  const m = s.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (m) id = m[1];
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) return null;
  return id;
}

function youtubeLiveEmbedUrl(channelId) {
  const q = new URLSearchParams({
    channel: channelId,
    autoplay: '0',
    modestbranding: '1',
  });
  return `https://www.youtube.com/embed/live_stream?${q.toString()}`;
}

module.exports = { normalizeYoutubeChannelId, youtubeLiveEmbedUrl };
