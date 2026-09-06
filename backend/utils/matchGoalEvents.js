const MatchScorer = require('../models/MatchScorer');
const Profile = require('../models/Profile');

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

function collectAffectedUserIds(rows) {
  const ids = new Set();
  for (const row of rows || []) {
    const uid = Number(row.userId);
    const aid = Number(row.assistUserId);
    if (Number.isFinite(uid) && uid > 0) ids.add(uid);
    if (Number.isFinite(aid) && aid > 0) ids.add(aid);
  }
  return [...ids];
}

/**
 * Recompute career goals/assists on Profile.stats from all MatchScorer rows.
 * Goals: each MatchScorer row for userId counts its `goals` (usually 1).
 * Assists: each MatchScorer row with assistUserId = user counts as 1 assist.
 */
async function syncProfileGoalAssistStats(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return;

  for (const userId of ids) {
    const goalsSum = await MatchScorer.sum('goals', { where: { userId } });
    const assistsCount = await MatchScorer.count({ where: { assistUserId: userId } });

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) continue;

    const stats =
      profile.stats && typeof profile.stats === 'object' && !Array.isArray(profile.stats)
        ? { ...profile.stats }
        : {};

    stats.goals = Number(goalsSum) || 0;
    stats.assists = Number(assistsCount) || 0;
    profile.stats = stats;
    profile.changed('stats', true);
    await profile.save();
  }
}

/**
 * Replace goal events for a match and sync player Profile.stats.
 * Changing/removing a scorer or assister recalculates their totals.
 */
async function saveMatchGoalEvents(matchId, rawEvents, match) {
  const previous = await MatchScorer.findAll({
    where: { matchId },
    attributes: ['userId', 'assistUserId', 'goals'],
  });
  const affected = new Set(collectAffectedUserIds(previous));

  await MatchScorer.destroy({ where: { matchId } });
  const rows = normalizeGoalEvents(rawEvents, match).map((row) => ({ ...row, matchId }));

  let created = [];
  if (rows.length) {
    created = await MatchScorer.bulkCreate(rows);
  }

  for (const id of collectAffectedUserIds(rows)) {
    affected.add(id);
  }

  try {
    await syncProfileGoalAssistStats([...affected]);
  } catch (syncErr) {
    console.error('syncProfileGoalAssistStats:', syncErr);
  }

  return created;
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
  syncProfileGoalAssistStats,
  sumGoalsForSide,
};
