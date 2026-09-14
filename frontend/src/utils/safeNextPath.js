/** Allow only same-origin relative paths for post-auth redirect. */
export function safeNextPath(raw, fallback = '/feed') {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('://')) return fallback;
  return s;
}
