/**
 * URL e njëjtë për web dhe mobile: YouTube iframe "channel live" (standard embed).
 * @param {string} channelId - UC…
 * @param {{ autoplay?: string, modestbranding?: string }} [opts]
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
