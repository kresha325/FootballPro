'use strict';

const { loadBundle } = require('../../utils/playerProfileCv');
const { projectPerformance } = require('./playerMath');
const { remember, TTL } = require('./cache');
const { UserAchievement } = require('../../models');

async function playerAnalytics(userId, filters = {}) {
  const id = Number(userId);
  const key = `player:${id}:${JSON.stringify({
    season: filters.season || null,
    competitionId: filters.competitionId || null,
    clubId: filters.clubId || null,
    from: filters.from || null,
    to: filters.to || null,
  })}`;
  return remember(key, TTL.player, async () => {
    const User = require('../../models/User');
    const Profile = require('../../models/Profile');
    const user = await User.findByPk(id, {
      attributes: ['id', 'firstName', 'lastName', 'role'],
      include: [{ model: Profile, attributes: ['position', 'club'] }],
    });
    if (!user) {
      const err = new Error('Player not found');
      err.status = 404;
      throw err;
    }
    const bundle = await loadBundle([id]);
    const report = projectPerformance(bundle, id, user.Profile?.position, filters);
    const achievements = await UserAchievement.count({ where: { userId: id } }).catch(() => 0);
    return {
      player: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
        position: user.Profile?.position || null,
        club: user.Profile?.club || null,
      },
      statisticsSource: report.source,
      hasOfficial: report.hasOfficial,
      unsupported: report.unsupported,
      career: { ...report.career, cumulative: true, label: 'Career' },
      window: {
        ...report.window,
        cumulative: false,
        label: filters.label || 'Selected range',
      },
      competitions: report.competitions,
      form: {
        last5: report.form.last5,
        last10: report.form.last10,
      },
      trends: report.trends,
      filters: report.filters,
      achievements,
      sources: {
        goals: 'match_events',
        appearances: 'match_participation',
        minutes: 'player_match_stats',
      },
    };
  });
}

module.exports = {
  playerAnalytics,
};
