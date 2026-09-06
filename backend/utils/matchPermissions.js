/**
 * Who may create/edit/schedule matches for a tournament:
 * - liga tournaments → only the liga account (creator + role liga)
 * - other tournaments → only the tournament creator
 */
function isLigaTournament(tournament) {
  if (!tournament) return false;
  return !!(tournament.ligaId || tournament.sourceRole === 'liga');
}

function canManageTournamentMatches(tournament, user) {
  if (!tournament || !user?.id) {
    return { ok: false, status: 403, msg: 'Nuk jeni të autorizuar.' };
  }
  const isCreator = Number(tournament.creatorId) === Number(user.id);
  if (!isCreator && user.role !== 'admin') {
    return {
      ok: false,
      status: 403,
      msg: isLigaTournament(tournament)
        ? 'Vetëm liga mund të krijojë / menaxhojë ndeshjet e këtij turneu.'
        : 'Vetëm krijuesi i turneut mund të krijojë / menaxhojë ndeshjet.',
    };
  }
  if (isLigaTournament(tournament) && user.role !== 'liga' && user.role !== 'admin') {
    return {
      ok: false,
      status: 403,
      msg: 'Vetëm liga mund të krijojë / menaxhojë ndeshjet e këtij turneu.',
    };
  }
  return { ok: true };
}

/** Score/stats: liga tournaments → liga only; others → creator (or admin). */
function canFillMatchStats(tournament, user, match) {
  if (!tournament || !user?.id) {
    return { ok: false, status: 403, msg: 'Nuk jeni të autorizuar.' };
  }
  if (user.role === 'admin') return { ok: true };

  if (isLigaTournament(tournament)) {
    if (Number(tournament.creatorId) !== Number(user.id) || user.role !== 'liga') {
      return {
        ok: false,
        status: 403,
        msg: 'Vetëm liga mund të plotësojë statistikat e ndeshjes.',
      };
    }
    return { ok: true };
  }

  const isCreator = Number(tournament.creatorId) === Number(user.id);
  const isParticipant =
    match &&
    (Number(match.homeUserId) === Number(user.id) || Number(match.awayUserId) === Number(user.id));

  if (!isCreator && !isParticipant) {
    return { ok: false, status: 403, msg: 'Nuk jeni të autorizuar të ndryshoni rezultatin.' };
  }
  return { ok: true };
}

module.exports = {
  isLigaTournament,
  canManageTournamentMatches,
  canFillMatchStats,
};
