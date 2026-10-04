/**
 * Standings from official match rows.
 * Default points: win 3, draw 1, loss 0.
 * Tie-breakers: points, head-to-head (mini-league), goal difference, goals scored, wins, user id.
 */

const DEFAULT_RULES = { win: 3, draw: 1, loss: 0 };

function emptyRow(userId) {
  return {
    userId: Number(userId),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function isCountableMatch(match) {
  if (!match) return false;
  if (match.awayUserId == null) return false;
  if (match.walkover) return false;
  const status = match.status || 'finished';
  if (status !== 'finished') return false;
  if (match.scoreHome == null || match.scoreAway == null) return false;
  return true;
}

function applyMatch(stats, match, rules = DEFAULT_RULES) {
  if (!isCountableMatch(match)) return;
  const home = Number(match.homeUserId);
  const away = Number(match.awayUserId);
  if (!stats[home] || !stats[away]) return;
  const goalsHome = Number(match.scoreHome) || 0;
  const goalsAway = Number(match.scoreAway) || 0;
  stats[home].played += 1;
  stats[away].played += 1;
  stats[home].goalsFor += goalsHome;
  stats[home].goalsAgainst += goalsAway;
  stats[away].goalsFor += goalsAway;
  stats[away].goalsAgainst += goalsHome;
  if (goalsHome > goalsAway) {
    stats[home].wins += 1;
    stats[home].points += rules.win;
    stats[away].losses += 1;
    stats[away].points += rules.loss;
  } else if (goalsAway > goalsHome) {
    stats[away].wins += 1;
    stats[away].points += rules.win;
    stats[home].losses += 1;
    stats[home].points += rules.loss;
  } else {
    stats[home].draws += 1;
    stats[away].draws += 1;
    stats[home].points += rules.draw;
    stats[away].points += rules.draw;
  }
}

function withDifference(row) {
  return {
    ...row,
    goalDifference: (row.goalsFor || 0) - (row.goalsAgainst || 0),
  };
}

function miniTable(teamIds, matches, rules) {
  const stats = {};
  teamIds.forEach((id) => {
    stats[Number(id)] = emptyRow(id);
  });
  const set = new Set(teamIds.map(Number));
  for (const match of matches || []) {
    if (!set.has(Number(match.homeUserId)) || !set.has(Number(match.awayUserId))) continue;
    applyMatch(stats, match, rules);
  }
  return stats;
}

function compareOverall(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  const gda = (a.goalsFor || 0) - (a.goalsAgainst || 0);
  const gdb = (b.goalsFor || 0) - (b.goalsAgainst || 0);
  if (gdb !== gda) return gdb - gda;
  if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
  if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
  return Number(a.userId) - Number(b.userId);
}

/**
 * Head-to-head among every team that shares `points`, then overall GD / GF / wins.
 */
function compareWithHeadToHead(a, b, allRows, matches, rules) {
  if (b.points !== a.points) return b.points - a.points;
  const tiedIds = allRows.filter((row) => row.points === a.points).map((row) => row.userId);
  if (tiedIds.length >= 2) {
    const mini = miniTable(tiedIds, matches, rules);
    const ma = mini[Number(a.userId)];
    const mb = mini[Number(b.userId)];
    if (ma && mb) {
      if (mb.points !== ma.points) return mb.points - ma.points;
      const gda = ma.goalsFor - ma.goalsAgainst;
      const gdb = mb.goalsFor - mb.goalsAgainst;
      if (gdb !== gda) return gdb - gda;
      if (mb.goalsFor !== ma.goalsFor) return mb.goalsFor - ma.goalsFor;
    }
  }
  return compareOverall(a, b);
}

function sortStandings(rows, matches, { headToHead = true, rules = DEFAULT_RULES } = {}) {
  const list = (rows || []).map(withDifference);
  const compare = headToHead
    ? (a, b) => compareWithHeadToHead(a, b, list, matches, rules)
    : compareOverall;
  const sorted = [...list].sort(compare);
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function standingsFromMatches(participantIds, matches, options = {}) {
  const rules = options.rules || DEFAULT_RULES;
  const stats = {};
  for (const id of participantIds || []) {
    if (id == null) continue;
    stats[Number(id)] = emptyRow(id);
  }
  const relevant = (matches || []).filter((match) => {
    if (options.groupName && match.groupName !== options.groupName) return false;
    if (options.stage && match.stage && match.stage !== options.stage) return false;
    return true;
  });
  for (const match of relevant) applyMatch(stats, match, rules);
  return sortStandings(Object.values(stats), relevant, {
    headToHead: options.headToHead !== false,
    rules,
  });
}

function groupStandings(participantIdsByGroup, matches, options = {}) {
  const out = {};
  for (const [group, ids] of Object.entries(participantIdsByGroup || {})) {
    const groupMatches = (matches || []).filter((match) => match.groupName === group);
    out[group] = standingsFromMatches(ids, groupMatches, { ...options, groupName: group, stage: 'group' });
  }
  return out;
}

module.exports = {
  DEFAULT_RULES,
  emptyRow,
  isCountableMatch,
  applyMatch,
  sortStandings,
  standingsFromMatches,
  groupStandings,
};
