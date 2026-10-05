/** Profile columns that exist on the Profile model (not stats JSON). */
const PROFILE_ROSTER_ATTRIBUTES = [
  'profilePhoto',
  'position',
  'bio',
  'stats',
  'age',
  'country',
  'city',
  'club',
];

function readStats(profile) {
  if (!profile?.stats || typeof profile.stats !== 'object' || Array.isArray(profile.stats)) {
    return {};
  }
  return profile.stats;
}

function profileNationality(profile) {
  return profile?.country || readStats(profile).nationality || null;
}

function profilePhysical(profile) {
  const stats = readStats(profile);
  return {
    height: stats.height ?? null,
    weight: stats.weight ?? null,
    preferredFoot: stats.preferredFoot ?? null,
  };
}

function profileCompletenessScore(profile, extras = {}) {
  const { buildCompleteness } = require('./playerProfileCv');
  return buildCompleteness(profile, extras);
}

module.exports = {
  PROFILE_ROSTER_ATTRIBUTES,
  readStats,
  profileNationality,
  profilePhysical,
  profileCompletenessScore,
};
