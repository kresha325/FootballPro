/** Rrugë avatar që API mund të kthejë — mos i ngarko nga domeni i backend-it. */
export function normalizeDefaultAvatarPath(url) {
  if (!url || typeof url !== 'string') return url;
  const u = url.trim();
  if (!u) return u;
  if (/(^|\/)default-avatar\.png$/i.test(u)) return '/default-avatar.svg';
  return u;
}

export function resolveStreamerPhotoUrl(url, siteRoot = '') {
  const normalized = normalizeDefaultAvatarPath(url);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('/default-avatar')) return normalized;
  if (!siteRoot) return normalized.startsWith('/') ? normalized : `/${normalized}`;
  return siteRoot + (normalized.startsWith('/') ? normalized : `/${normalized}`);
}
