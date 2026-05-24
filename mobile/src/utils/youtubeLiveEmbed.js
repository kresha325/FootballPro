/**
 * E njëjta logjikë si frontend/src/utils/youtubeLiveEmbed.js — embed standard YouTube për kanalin live.
 */
export function buildYoutubeChannelLiveEmbedUrl(channelId, opts = {}) {
  if (!channelId || typeof channelId !== 'string') return '';
  const { autoplay = '1', modestbranding = '1' } = opts;
  const q = new URLSearchParams({
    channel: channelId.trim(),
    autoplay,
    modestbranding,
  });
  return `https://www.youtube.com/embed/live_stream?${q.toString()}`;
}

export function buildYoutubeChannelLiveWatchUrl(channelId) {
  if (!channelId || typeof channelId !== 'string') return '';
  return `https://www.youtube.com/channel/${channelId.trim()}/live`;
}
