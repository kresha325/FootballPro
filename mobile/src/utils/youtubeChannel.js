/**
 * Normalizon ID-në e kanalit YouTube (UC + 22 karaktere) ose link channel/UC…
 */
export function normalizeYoutubeChannelId(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let id = s;
  const m = s.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (m) id = m[1];
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) return null;
  return id;
}
