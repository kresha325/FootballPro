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

function profileCompletenessScore(profile) {
  const stats = readStats(profile);
  const checks = [
    profile?.bio,
    profile?.club,
    profile?.position,
    profile?.country,
    stats.height,
    stats.weight,
    stats.preferredFoot,
  ];
  const filled = checks.filter(Boolean).length;
  return { filled, total: checks.length };
}

module.exports = {
  PROFILE_ROSTER_ATTRIBUTES,
  readStats,
  profileNationality,
  profilePhysical,
  profileCompletenessScore,
};
