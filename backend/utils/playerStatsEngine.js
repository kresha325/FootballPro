/**
 * Season / competition player totals derived from match rows.
 * Goals and assists prefer MatchScorer. Stat-line goals are ignored when a scorer
 * row already exists for that player in the same match, so totals are not doubled.
 */

function blank(userId) {
  return {
    userId: Number(userId),
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

function bucket(map, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (!map[id]) map[id] = blank(id);
  return map[id];
}

function aggregatePlayerStats({ scorers = [], events = [], statRows = [], matches = [] } = {}) {
  const map = {};
  const scorerGoalsByMatchUser = new Set();
  const assistByMatchUser = new Set();

  for (const row of scorers) {
    const player = bucket(map, row.userId);
    if (!player) continue;
    const goals = Number(row.goals) || 0;
    player.goals += goals;
    scorerGoalsByMatchUser.add(`${row.matchId}:${row.userId}`);
    if (row.assistUserId) {
      const assister = bucket(map, row.assistUserId);
      if (assister) {
        assister.assists += 1;
        assistByMatchUser.add(`${row.matchId}:${row.assistUserId}`);
      }
    }
  }

  for (const event of events) {
    const player = bucket(map, event.userId);
    if (!player) {
      continue;
    }
    if (event.type === 'yellow_card') player.yellowCards += 1;
    else if (event.type === 'red_card') player.redCards += 1;
    else if (event.type === 'own_goal') player.ownGoals += 1;
    else if (event.type === 'assist' && !assistByMatchUser.has(`${event.matchId}:${event.userId}`)) {
      player.assists += 1;
      assistByMatchUser.add(`${event.matchId}:${event.userId}`);
    } else if (
      (event.type === 'goal' || event.type === 'penalty') &&
      !scorerGoalsByMatchUser.has(`${event.matchId}:${event.userId}`)
    ) {
      player.goals += 1;
      scorerGoalsByMatchUser.add(`${event.matchId}:${event.userId}`);
    }
  }

  const matchById = Object.fromEntries((matches || []).map((m) => [Number(m.id), m]));

  for (const row of statRows) {
    const player = bucket(map, row.userId);
    if (!player) continue;
    const minutes = Number(row.minutes) || 0;
    player.minutes += minutes;
    player.shots += Number(row.shots) || 0;
    player.shotsOnTarget += Number(row.shotsOnTarget) || 0;
    player.passes += Number(row.passes) || 0;
    player.keyPasses += Number(row.keyPasses) || 0;
    player.fouls += Number(row.fouls) || 0;
    player.saves += Number(row.saves) || 0;
    if (row.started) player.starts += 1;
    if (minutes > 0 || row.started) player.appearances += 1;
    if (!scorerGoalsByMatchUser.has(`${row.matchId}:${row.userId}`)) {
      const extraGoals = Number(row.goals) || 0;
      if (extraGoals) {
        player.goals += extraGoals;
        scorerGoalsByMatchUser.add(`${row.matchId}:${row.userId}`);
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

  return Object.values(map)
    .map((row) => ({
      ...row,
      rating: row.ratingCount ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.userId - b.userId);
}

module.exports = {
  blank,
  aggregatePlayerStats,
};
