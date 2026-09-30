/**
 * YouTube VOD URL parser (mirrors backend/utils/youtubeVideo.js).
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
  return ALLOWED_HOSTS.has(String(hostname || '').toLowerCase());
}

function extractIdFromPath(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  if (!parts.length) return null;
  const markers = ['embed', 'shorts', 'v', 'live', 'e'];
  const idx = parts.findIndex((p) => markers.includes(p.toLowerCase()));
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].slice(0, 11);
  if (parts.length === 1 && YT_ID_RE.test(parts[0])) return parts[0];
  return null;
}

export function parseYouTubeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'YouTube URL is required' };

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

  if (!videoId && url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    videoId = hashParams.get('v') || hashParams.get('vi') || null;
  }

  if (videoId) {
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

export function youtubeThumbnailUrl(videoId, quality = 'hqdefault') {
  const id = String(videoId || '');
  if (!YT_ID_RE.test(id)) return '';
  return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
}

export function youtubeEmbedUrl(videoId) {
  const id = String(videoId || '');
  if (!YT_ID_RE.test(id)) return '';
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export const MEDIA_CATEGORIES = [
  { value: 'profile', label: 'Profil' },
  { value: 'match', label: 'Ndeshje e plotë' },
  { value: 'match_highlight', label: 'Highlights' },
  { value: 'goal', label: 'Gola' },
  { value: 'skills', label: 'Skills' },
  { value: 'training', label: 'Trajnim' },
  { value: 'interview', label: 'Intervistë' },
  { value: 'other', label: 'Tjetër' },
];

export const MEDIA_VISIBILITIES = [
  { value: 'public', label: 'Publike' },
  { value: 'unlisted', label: 'E palistuar' },
  { value: 'private', label: 'Private' },
];
