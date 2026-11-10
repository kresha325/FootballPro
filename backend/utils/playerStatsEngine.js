/**
 * Season / competition player totals derived from match rows.
 * Goals and assists prefer MatchScorer, then match events, then the stat line.
 * A stat-line value is ignored when that match already counted the same fact
 * from a scorer row or event, so totals are not doubled.
 * Cards prefer match events, then the stat line for that match.
 */

function blank(userId) {
  return {
    userId: Number(userId),
    athleteIdentityKey: null,
    athleteName: null,
    appearances: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    keyPasses: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    cleanSheets: 0,
    ownGoals: 0,
    ratingSum: 0,
    ratingCount: 0,
  };
}

function blankUnknown(identityKey, athleteName) {
  return {
    ...blank(null),
    athleteIdentityKey: identityKey || null,
    athleteName: athleteName || null,
  };
}

function bucket(map, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (!map[id]) map[id] = blank(id);
  return map[id];
}

function identityFor(row, source, fallbackIndex) {
  const id = Number(row?.userId);
  if (Number.isInteger(id) && id > 0) return `u:${id}`;
  const identityKey = String(row?.athleteIdentityKey || '').trim().toLowerCase();
  if (identityKey) return `i:${identityKey}`;
  // Historical name-only rows are deliberately kept distinct. Their identity
  // cannot be reconstructed safely from a shared name.
  return `legacy:${source}:${row?.id ?? fallbackIndex}`;
}

function identityBucket(map, row, source, fallbackIndex) {
  const userId = Number(row?.userId);
  const key = identityFor(row, source, fallbackIndex);
  if (!map[key]) {
    map[key] = Number.isInteger(userId) && userId > 0
      ? blank(userId)
      : blankUnknown(row?.athleteIdentityKey || null, row?.athleteName || null);
  } else if (!map[key].athleteName && row?.athleteName) {
    map[key].athleteName = row.athleteName;
  }
  return map[key];
}

function aggregatePlayerStats({ scorers = [], events = [], statRows = [], matches = [] } = {}) {
  const map = {};
  const scorerGoalsByMatchUser = new Set();
  const assistByMatchUser = new Set();
  const scorerGoalTotalsByMatchUser = new Map();
  const assistTotalsByMatchUser = new Map();
  const yellowByMatchUser = new Set();
  const redByMatchUser = new Set();
  const startedByMatchUser = new Set();
  const appearedByMatchUser = new Set();

  for (const [index, row] of scorers.entries()) {
    const player = identityBucket(map, row, 'scorer', index);
    const goals = Number(row.goals) || 0;
    player.goals += goals;
    const goalKey = `${row.matchId}:${identityFor(row, 'scorer', index)}`;
    scorerGoalsByMatchUser.add(goalKey);
    scorerGoalTotalsByMatchUser.set(goalKey, (scorerGoalTotalsByMatchUser.get(goalKey) || 0) + goals);
    if (row.assistUserId) {
      const assister = bucket(map, row.assistUserId);
      if (assister) {
        assister.assists += 1;
        const assistKey = `${row.matchId}:${row.assistUserId}`;
        assistByMatchUser.add(assistKey);
        assistTotalsByMatchUser.set(assistKey, (assistTotalsByMatchUser.get(assistKey) || 0) + 1);
      }
    }
  }

  for (const [index, event] of events.entries()) {
    const player = identityBucket(map, event, 'event', index);
    const eventKey = `${event.matchId}:${identityFor(event, 'event', index)}`;
    if (event.type === 'yellow_card') {
      player.yellowCards += 1;
      yellowByMatchUser.add(eventKey);
    } else if (event.type === 'red_card') {
      player.redCards += 1;
      redByMatchUser.add(eventKey);
    }
    else if (event.type === 'own_goal') player.ownGoals += 1;
    else if (event.type === 'assist' && !assistByMatchUser.has(eventKey)) {
      player.assists += 1;
      assistByMatchUser.add(eventKey);
    } else if (
      (event.type === 'goal' || event.type === 'penalty') &&
      !scorerGoalsByMatchUser.has(eventKey)
    ) {
      player.goals += 1;
      scorerGoalsByMatchUser.add(eventKey);
    }
  }

  const matchById = Object.fromEntries((matches || []).map((m) => [Number(m.id), m]));

  for (const [index, row] of statRows.entries()) {
    const player = identityBucket(map, row, 'stat', index);
    const minutes = Number(row.minutes) || 0;
    player.minutes += minutes;
    player.shots += Number(row.shots) || 0;
    player.shotsOnTarget += Number(row.shotsOnTarget) || 0;
    player.passes += Number(row.passes) || 0;
    player.keyPasses += Number(row.keyPasses) || 0;
    player.fouls += Number(row.fouls) || 0;
    player.saves += Number(row.saves) || 0;
    if (row.started) player.starts += 1;
    const key = `${row.matchId}:${identityFor(row, 'stat', index)}`;
    if (row.started) startedByMatchUser.add(key);
    if (minutes > 0 || row.started) {
      player.appearances += 1;
      appearedByMatchUser.add(key);
    }
    const goalKey = `${row.matchId}:${identityFor(row, 'stat', index)}`;
    const extraGoals = Math.max(0, (Number(row.goals) || 0) - (scorerGoalTotalsByMatchUser.get(goalKey) || 0));
    if (extraGoals) player.goals += extraGoals;
    const assistKey = `${row.matchId}:${identityFor(row, 'stat', index)}`;
    const extraAssists = Math.max(0, (Number(row.assists) || 0) - (assistTotalsByMatchUser.get(assistKey) || 0));
    if (extraAssists) player.assists += extraAssists;
    if (!yellowByMatchUser.has(`${row.matchId}:${identityFor(row, 'stat', index)}`)) {
      const extraYellow = Number(row.yellowCards) || 0;
      if (extraYellow) {
        player.yellowCards += extraYellow;
        yellowByMatchUser.add(`${row.matchId}:${identityFor(row, 'stat', index)}`);
      }
    }
    if (!redByMatchUser.has(`${row.matchId}:${identityFor(row, 'stat', index)}`)) {
      const extraRed = Number(row.redCards) || 0;
      if (extraRed) {
        player.redCards += extraRed;
        redByMatchUser.add(`${row.matchId}:${identityFor(row, 'stat', index)}`);
      }
    }
    if (row.rating != null && row.rating !== '') {
      const rating = Number(row.rating);
      if (Number.isFinite(rating)) {
        player.ratingSum += rating;
        player.ratingCount += 1;
      }
    }
    const match = matchById[Number(row.matchId)];
    const explicit = row.cleanSheet === true || row.cleanSheet === false ? row.cleanSheet : null;
    if (explicit === true) player.cleanSheets += 1;
    else if (explicit == null && match && minutes >= 60) {
      const side = row.side || (Number(row.userId) === Number(match.homeUserId) ? 'home' : Number(row.userId) === Number(match.awayUserId) ? 'away' : null);
      const conceded = side === 'home' ? Number(match.scoreAway) : side === 'away' ? Number(match.scoreHome) : null;
      if (conceded === 0 && (Number(row.saves) > 0 || row.goalkeeper)) player.cleanSheets += 1;
    }
  }

  for (const match of matches || []) {
    const status = String(match.status || '').toLowerCase();
    if (['scheduled', 'cancelled', 'postponed', 'live', 'in_progress', 'ongoing'].includes(status)) continue;
    if (match.scoreHome == null || match.scoreAway == null) continue;
    for (const ids of [match.lineup?.home, match.lineup?.away]) {
      if (!Array.isArray(ids)) continue;
      for (const userId of ids) {
        const player = bucket(map, userId);
        if (!player) continue;
        const key = `${match.id}:${Number(userId)}`;
        if (!startedByMatchUser.has(key)) {
          player.starts += 1;
          startedByMatchUser.add(key);
        }
        if (!appearedByMatchUser.has(key)) {
          player.appearances += 1;
          appearedByMatchUser.add(key);
        }
      }
    }
  }

  return Object.values(map)
    .map((row) => ({
      ...row,
      rating: row.ratingCount ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (Number(a.userId) || 0) - (Number(b.userId) || 0) || String(a.athleteName || '').localeCompare(String(b.athleteName || '')) || String(a.athleteIdentityKey || '').localeCompare(String(b.athleteIdentityKey || '')));
}

module.exports = {
  blank,
  identityFor,
  aggregatePlayerStats,
};
