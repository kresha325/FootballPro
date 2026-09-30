/** Format standings points vs max from matches played (3 pts per match). */
export function formatPointsRatio(points, playedOrPossible, { possibleIsMax = false } = {}) {
  const earned = Number(points) || 0;
  const possible = possibleIsMax
    ? Number(playedOrPossible) || 0
    : (Number(playedOrPossible) || 0) * 3;
  return `${earned}/${possible}`;
}

export function formatTournamentPoints(row) {
  if (!row || typeof row !== 'object') return '0/0';
  if (row.pointsPossible != null) {
    return formatPointsRatio(row.points, row.pointsPossible, { possibleIsMax: true });
  }
  return formatPointsRatio(row.points, row.played);
}

export function formatTotalsPoints(totals) {
  if (!totals || typeof totals !== 'object') return '0/0';
  if (totals.pointsPossible != null) {
    return formatPointsRatio(totals.points, totals.pointsPossible, { possibleIsMax: true });
  }
  return formatPointsRatio(totals.points, totals.matchesPlayed);
}
