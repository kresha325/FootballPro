'use strict';

const { isVerifiedClub, isActiveCoachAssignment } = require('./managedAthleteRegistration');

/**
 * Scope a target athlete's membership rows to the caller's relationship.
 * Public authenticated viewers keep approved sports history; administrative
 * membership states are visible only to the athlete, guardian, admin or the
 * specific verified club/active coach responsible for that row.
 */
function visibleAthleteMemberships({ viewer, athlete, memberships, verifiedClubs = [], staffAssignments = [], verifiedGuardian = false }) {
  const viewerId = Number(viewer?.id);
  const athleteId = Number(athlete?.id);
  if (!viewerId || !athleteId) return [];
  if (String(viewer?.role || '').toLowerCase() === 'admin' || viewerId === athleteId || verifiedGuardian) {
    return memberships;
  }

  const clubs = new Map(verifiedClubs.filter(isVerifiedClub).map((club) => [Number(club.id), club]));
  const allowedClubIds = new Set();
  for (const membership of memberships) {
    const clubId = Number(membership.clubId);
    const club = clubs.get(clubId);
    if (!club) continue;
    if (String(viewer?.role || '').toLowerCase() === 'club' && viewerId === clubId) {
      allowedClubIds.add(clubId);
      continue;
    }
    const assignment = staffAssignments.find((row) => Number(row.clubId) === clubId && Number(row.staffId) === viewerId);
    if (isActiveCoachAssignment(viewer, assignment, clubId)) allowedClubIds.add(clubId);
  }

  if (allowedClubIds.size) {
    return memberships.filter((membership) => allowedClubIds.has(Number(membership.clubId)));
  }
  return memberships.filter((membership) => membership.status === 'approved');
}

module.exports = { visibleAthleteMemberships };
