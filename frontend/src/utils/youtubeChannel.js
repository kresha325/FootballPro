/**
 * Normalizon Channel ID të YouTube (fillon me UC, ~24 karaktere gjithsej).
 */
export function normalizeYoutubeChannelId(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim().replace(/\s+/g, '');
  if (!s) return null;

  const urlMatch = s.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i);
  if (urlMatch) s = urlMatch[1];

  s = s.split(/[?#&]/)[0];

  if (/^uc[a-zA-Z0-9_-]+$/i.test(s) && !s.startsWith('UC')) {
    s = `UC${s.slice(2)}`;
  }

  if (!/^UC/i.test(s) && /^[a-zA-Z0-9_-]{22}$/.test(s)) {
    s = `UC${s}`;
  }

  if (/^UC[a-zA-Z0-9_-]{21,24}$/.test(s)) {
    return s;
  }

  return null;
}

/** A ka nevojë për API resolve (@handle, link pa /channel/UC) */
export function needsYoutubeResolve(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (normalizeYoutubeChannelId(s)) return false;
  return true;
}
