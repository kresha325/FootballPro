'use strict';

const { Op, fn, col } = require('sequelize');
const { ACTIVE_SHORTLIST } = require('../../utils/scoutingEngine');
const { createdBetween } = require('./formulas');
const { remember, TTL } = require('./cache');

async function distinctPlayers(scoutId, range) {
  const { ScoutShortlist, ScoutWatchlist, ScoutingReport } = require('../../models');
  const between = createdBetween(range);
  const shortWhere = { scoutId };
  const watchWhere = { scoutId };
  const reportWhere = { scoutId, status: 'completed' };
  if (between) {
    shortWhere.createdAt = between;
    watchWhere.createdAt = between;
    reportWhere.createdAt = between;
  }
  const [shortlist, watchlist, reports] = await Promise.all([
    ScoutShortlist.findAll({ where: shortWhere, attributes: ['playerId'], raw: true }),
    ScoutWatchlist.findAll({ where: watchWhere, attributes: ['playerId'], raw: true }),
    ScoutingReport.findAll({ where: reportWhere, attributes: ['playerId'], raw: true }),
  ]);
  const ids = new Set();
  for (const row of [...shortlist, ...watchlist, ...reports]) ids.add(Number(row.playerId));
  return ids.size;
}

async function scoutAnalytics(scoutId, range) {
  return remember(`scout:${scoutId}:${range?.key || 'all'}:${range?.from || ''}`, TTL.scouting, async () => {
    const { ScoutShortlist, ScoutWatchlist, ScoutingReport, ScoutWatchEvent } = require('../../models');
    const between = createdBetween(range);
    const shortWhere = { scoutId };
    const reportWhere = { scoutId };
    const eventWhere = { scoutId };
    if (between) {
      shortWhere.createdAt = between;
      reportWhere.createdAt = between;
      eventWhere.createdAt = between;
    }
    const [discovered, shortlisted, watched, draftReports, completedReports, activeProspects, statusRows] = await Promise.all([
      distinctPlayers(scoutId, range),
      ScoutShortlist.count({ where: shortWhere }),
      ScoutWatchlist.count({ where: between ? { scoutId, createdAt: between } : { scoutId } }),
      ScoutingReport.count({ where: { ...reportWhere, status: 'draft' } }),
      ScoutingReport.count({ where: { ...reportWhere, status: 'completed' } }),
      ScoutShortlist.count({ where: { ...shortWhere, status: { [Op.in]: [...ACTIVE_SHORTLIST] } } }),
      ScoutWatchEvent.findAll({
        where: eventWhere,
        attributes: ['type', [fn('COUNT', col('id')), 'count']],
        group: ['type'],
        raw: true,
      }),
    ]);
    return {
      playersDiscovered: discovered,
      playersDiscoveredNote: 'Distinct players on the shortlist, watchlist, or in a completed report. Not a separate discovery score.',
      playersShortlisted: shortlisted,
      playersWatched: watched,
      reports: { draft: draftReports, completed: completedReports },
      activeProspects,
      statusChanges: statusRows.map((row) => ({ type: row.type, count: Number(row.count) || 0 })),
      privateNotes: 'omitted',
    };
  });
}

async function playerScoutingInterest(playerId, range) {
  const { ScoutingReport } = require('../../models');
  const where = { playerId, status: 'completed' };
  const between = createdBetween(range);
  if (between) where.createdAt = between;
  const row = await ScoutingReport.findOne({
    where,
    attributes: [
      [fn('COUNT', col('id')), 'evaluations'],
      [fn('COUNT', fn('DISTINCT', col('scoutId'))), 'scouts'],
      [fn('AVG', col('overallRating')), 'averageRating'],
    ],
    raw: true,
  });
  const evaluations = Number(row?.evaluations) || 0;
  const average = row?.averageRating == null ? null : Math.round(Number(row.averageRating) * 10) / 10;
  return {
    evaluations,
    scouts: Number(row?.scouts) || 0,
    averageScoutRating: evaluations ? average : null,
    privateNotes: 'omitted',
    source: 'ScoutingReport status=completed',
  };
}

module.exports = {
  scoutAnalytics,
  playerScoutingInterest,
};
