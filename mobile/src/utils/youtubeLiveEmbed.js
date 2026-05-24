/**
 * E njëjta logjikë si frontend/src/utils/youtubeLiveEmbed.js — embed standard YouTube për kanalin live.
 */
import { buildQueryString } from './queryString';

export function buildYoutubeChannelLiveEmbedUrl(channelId, opts = {}) {
  if (!channelId || typeof channelId !== 'string') return '';
  const { autoplay = '1', modestbranding = '1' } = opts;
  const q = buildQueryString({
    channel: channelId.trim(),
    autoplay,
    modestbranding,
  });
  return `https://www.youtube.com/embed/live_stream?${q}`;
}

export function buildYoutubeChannelLiveWatchUrl(channelId) {
  if (!channelId || typeof channelId !== 'string') return '';
  return `https://www.youtube.com/channel/${channelId.trim()}/live`;
}
