const MatchScorer = require('../models/MatchScorer');

function inferSide(userId, match) {
  const uid = Number(userId);
  if (uid === Number(match.homeUserId)) return 'home';
  if (uid === Number(match.awayUserId)) return 'away';
  return null;
}

function normalizeGoalEvents(rawEvents, match) {
  if (!Array.isArray(rawEvents)) return [];

  const rows = [];
  for (const item of rawEvents) {
    const userId = parseInt(item.userId, 10);
    if (!Number.isFinite(userId)) continue;

    const minuteRaw = item.minute;
    const minute = minuteRaw === '' || minuteRaw == null ? null : parseInt(minuteRaw, 10);
    const assistUserIdRaw = item.assistUserId;
    const assistUserId =
      assistUserIdRaw === '' || assistUserIdRaw == null ? null : parseInt(assistUserIdRaw, 10);

    const side = item.side === 'home' || item.side === 'away' ? item.side : inferSide(userId, match);
    const hasEventMeta = minute != null || (Number.isFinite(assistUserId) && assistUserId > 0) || side;

    if (hasEventMeta) {
      rows.push({
        userId,
        goals: 1,
        minute: Number.isFinite(minute) ? minute : null,
        assistUserId: Number.isFinite(assistUserId) ? assistUserId : null,
        side,
      });
      continue;
    }

    const count = Math.max(1, parseInt(item.goals, 10) || 1);
    for (let i = 0; i < count; i += 1) {
      rows.push({
        userId,
        goals: 1,
        minute: null,
        assistUserId: null,
        side: inferSide(userId, match),
      });
    }
  }
  return rows;
}

async function saveMatchGoalEvents(matchId, rawEvents, match) {
  await MatchScorer.destroy({ where: { matchId } });
  const rows = normalizeGoalEvents(rawEvents, match).map((row) => ({ ...row, matchId }));
  if (!rows.length) return [];
  return MatchScorer.bulkCreate(rows);
}

function sumGoalsForSide(scorers, side, teamUserId) {
  return scorers
    .filter((s) => s.side === side || (!s.side && Number(s.userId) === Number(teamUserId)))
    .reduce((acc, s) => acc + (Number(s.goals) || 0), 0);
}

module.exports = {
  inferSide,
  normalizeGoalEvents,
  saveMatchGoalEvents,
  sumGoalsForSide,
};
