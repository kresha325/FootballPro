/** Group tournament matches by round number (ascending). */
export function groupMatchesByRound(matches) {
  const buckets = {};
  for (const m of matches || []) {
    const r = Number(m.round) || 1;
    if (!buckets[r]) buckets[r] = [];
    buckets[r].push(m);
  }
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((round) => ({
      round,
      matches: buckets[round].sort((a, b) => {
        const da = a.matchDate ? new Date(a.matchDate).getTime() : 0;
        const db = b.matchDate ? new Date(b.matchDate).getTime() : 0;
        return da - db || (a.id || 0) - (b.id || 0);
      }),
    }));
}

export function knockoutRoundLabel(round, roundNumbers) {
  const nums = roundNumbers.length ? roundNumbers : [round];
  const max = Math.max(...nums);
  if (nums.length === 1) return 'Final';
  if (round === max) return 'Final';
  if (round === max - 1) return 'Semi-final';
  if (round === max - 2 && max >= 3) return 'Quarter-final';
  return `Round ${round}`;
}

export function isMatchWinnerSide(match, side) {
  if (!match || match.status !== 'finished') return false;
  const sh = Number(match.scoreHome);
  const sa = Number(match.scoreAway);
  if (!Number.isFinite(sh) || !Number.isFinite(sa) || sh === sa) return false;
  return side === 'home' ? sh > sa : sa > sh;
}

/** Normalize GET /bracket API shape to match objects per round. */
export function roundsFromBracketApi(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const out = [];
  for (const key of Object.keys(data)) {
    const round = Number(key);
    if (!Number.isFinite(round)) continue;
    const items = Array.isArray(data[key]) ? data[key] : [];
    const matches = items
      .map((item) => item?.Match || item?.match || item)
      .filter((m) => m && (m.id || m.homeUserId || m.awayUserId));
    if (matches.length) out.push({ round, matches });
  }
  return out.length ? out.sort((a, b) => a.round - b.round) : null;
}
