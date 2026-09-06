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

/**
 * Score/stats: only the tournament/match creator (by creatorId), or admin.
 * Being the creator is enough — do not require role === 'liga' again.
 */
function canFillMatchStats(tournament, user, _match) {
  if (!tournament || !user?.id) {
    return { ok: false, status: 403, msg: 'Nuk jeni të autorizuar.' };
  }
  if (user.role === 'admin') return { ok: true };
  if (Number(tournament.creatorId) === Number(user.id)) return { ok: true };
  return {
    ok: false,
    status: 403,
    msg: 'Vetëm krijuesi i ndeshjes mund të vendosë dhe ruajë statistikat.',
  };
}

module.exports = {
  isLigaTournament,
  canManageTournamentMatches,
  canFillMatchStats,
};
