/**
 * YouTube VOD URL parser — extract & validate video IDs.
 * Never trust client-provided IDs without re-parsing a URL.
 */

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return ALLOWED_HOSTS.has(host) || ALLOWED_HOSTS.has(`www.${host}`);
}

function extractIdFromPath(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  if (!parts.length) return null;

  // /embed/VIDEO_ID, /shorts/VIDEO_ID, /v/VIDEO_ID, /live/VIDEO_ID
  const markers = ['embed', 'shorts', 'v', 'live', 'e'];
  const idx = parts.findIndex((p) => markers.includes(p.toLowerCase()));
  if (idx >= 0 && parts[idx + 1]) {
    return parts[idx + 1].slice(0, 11);
  }

  // youtu.be/VIDEO_ID
  if (parts.length === 1 && YT_ID_RE.test(parts[0])) {
    return parts[0];
  }

  return null;
}

/**
 * @param {string} input
 * @returns {{ ok: true, videoId: string, youtubeUrl: string, thumbnailUrl: string, embedUrl: string } | { ok: false, error: string }}
 */
function parseYouTubeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return { ok: false, error: 'YouTube URL is required' };
  }

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Unsupported URL protocol' };
  }

  if (!isAllowedHost(url.hostname)) {
    return { ok: false, error: 'Only YouTube URLs are allowed' };
  }

  let videoId =
    url.searchParams.get('v') ||
    url.searchParams.get('vi') ||
    extractIdFromPath(url.pathname);

  // Some share links put the id in the fragment: #v=VIDEO_ID
  if (!videoId && url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    videoId = hashParams.get('v') || hashParams.get('vi') || null;
  }

  if (videoId) {
    // Strip query leftovers from path-extracted ids
    videoId = String(videoId).split('&')[0].split('?')[0].split('#')[0];
  }

  if (!videoId || !YT_ID_RE.test(videoId)) {
    return { ok: false, error: 'Could not extract a valid YouTube video ID' };
  }

  return {
    ok: true,
    videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: youtubeThumbnailUrl(videoId),
    embedUrl: youtubeEmbedUrl(videoId),
  };
}

function youtubeThumbnailUrl(videoId, quality = 'hqdefault') {
  const id = String(videoId || '');
  if (!YT_ID_RE.test(id)) return '';
  return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
}

function youtubeEmbedUrl(videoId) {
  const id = String(videoId || '');
  if (!YT_ID_RE.test(id)) return '';
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

function isValidYouTubeVideoId(id) {
  return YT_ID_RE.test(String(id || ''));
}

module.exports = {
  parseYouTubeUrl,
  youtubeThumbnailUrl,
  youtubeEmbedUrl,
  isValidYouTubeVideoId,
  YT_ID_RE,
};
