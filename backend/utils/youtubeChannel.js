'use strict';

/** UC + 21–24 karaktere (zakonisht 22 pas UC = 24 gjithsej) */
const UC_CHANNEL_RE = /^UC[a-zA-Z0-9_-]{21,24}$/;

/**
 * Normalizon ID-në e kanalit YouTube.
 * Pranon UC…, …/channel/UC…, ose trupin 22-shkarakterë pa UC.
 */
function normalizeYoutubeChannelId(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim().replace(/\s+/g, '');
  if (!s) return null;

  const m = s.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i);
  if (m) s = m[1];

  s = s.split(/[?#&]/)[0];

  if (/^uc[a-zA-Z0-9_-]+$/i.test(s) && !s.startsWith('UC')) {
    s = `UC${s.slice(2)}`;
  }

  if (!/^UC/i.test(s) && /^[a-zA-Z0-9_-]{22}$/.test(s)) {
    s = `UC${s}`;
  }

  if (!UC_CHANNEL_RE.test(s)) return null;
  return s;
}

function buildYoutubeFetchTarget(input) {
  const s = String(input || '').trim();
  if (!s) return null;

  const direct = normalizeYoutubeChannelId(s);
  if (direct) {
    return { fetchUrl: `https://www.youtube.com/channel/${direct}`, channelId: direct };
  }

  if (/^https?:\/\//i.test(s)) {
    return { fetchUrl: s, channelId: null };
  }

  const handleFromAt = s.match(/(?:youtube\.com\/@|youtu\.be\/@?)([a-zA-Z0-9._-]+)/i);
  const bareHandle = s.replace(/^@/, '').split(/[/?#]/)[0];

  if (s.includes('/@') || s.startsWith('@') || (!s.includes('youtube.com') && !s.startsWith('UC'))) {
    const handle = (handleFromAt && handleFromAt[1]) || bareHandle;
    if (handle) {
      return { fetchUrl: `https://www.youtube.com/@${encodeURIComponent(handle)}`, channelId: null };
    }
  }

  if (/^UC/i.test(s)) {
    return { fetchUrl: `https://www.youtube.com/channel/${s}`, channelId: null };
  }

  return { fetchUrl: `https://www.youtube.com/${s}`, channelId: null };
}

function extractChannelIdFromHtml(html) {
  const patterns = [
    /"channelId":"(UC[a-zA-Z0-9_-]{21,24})"/,
    /"externalId":"(UC[a-zA-Z0-9_-]{21,24})"/,
    /"browseId":"(UC[a-zA-Z0-9_-]{21,24})"/,
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{21,24})/i,
    /item_id=(UC[a-zA-Z0-9_-]{21,24})/,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && UC_CHANNEL_RE.test(m[1])) return m[1];
  }
  return null;
}

async function resolveYoutubeChannelFromUrl(input) {
  const target = buildYoutubeFetchTarget(input);
  if (!target) return null;
  if (target.channelId) return target.channelId;

  const res = await fetch(target.fetchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    const err = new Error(`YouTube HTTP ${res.status}`);
    err.code = 'YOUTUBE_HTTP';
    throw err;
  }

  const fromFinalUrl = normalizeYoutubeChannelId(res.url || '');
  if (fromFinalUrl) return fromFinalUrl;

  const html = await res.text();
  const fromHtml = extractChannelIdFromHtml(html);
  if (fromHtml) return fromHtml;

  return null;
}

function youtubeLiveEmbedUrl(channelId) {
  const q = new URLSearchParams({
    channel: channelId,
    autoplay: '0',
    modestbranding: '1',
  });
  return `https://www.youtube.com/embed/live_stream?${q.toString()}`;
}

module.exports = {
  normalizeYoutubeChannelId,
  youtubeLiveEmbedUrl,
  resolveYoutubeChannelFromUrl,
};
