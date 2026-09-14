/** Roles that represent organizations, not people — no athlete age groups. */
export const ORG_PROFILE_ROLES = new Set([
  'club',
  'liga',
  'media',
  'business',
  'federation',
]);

export function isOrgProfileRole(role) {
  return ORG_PROFILE_ROLES.has(String(role || '').toLowerCase());
}

/**
 * Resolve founding year from stats / liga field / dateOfBirth / name (e.g. "… 2017").
 */
export function getFoundingYear(profile = {}) {
  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const candidates = [
    profile.foundedYear,
    profile.foundingYear,
    stats.founded,
    stats.foundedYear,
  ];

  for (const raw of candidates) {
    if (raw == null || String(raw).trim() === '') continue;
    const digits = String(raw).match(/\b(18|19|20)\d{2}\b/);
    if (digits) {
      const y = parseInt(digits[0], 10);
      if (y >= 1800 && y <= 2100) return y;
    }
    const n = parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n >= 1800 && n <= 2100) return n;
  }

  if (profile.dateOfBirth) {
    const y = new Date(profile.dateOfBirth).getFullYear();
    if (Number.isFinite(y) && y >= 1800 && y <= 2100) return y;
  }

  const name = [profile.club, profile.firstName, profile.lastName, profile.name]
    .filter(Boolean)
    .join(' ');
  const fromName = name.match(/\b(18|19|20)\d{2}\b/);
  if (fromName) return parseInt(fromName[0], 10);

  return null;
}
