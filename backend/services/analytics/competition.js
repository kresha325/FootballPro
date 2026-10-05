'use strict';

const { Op } = require('sequelize');
const { remember, TTL } = require('./cache');
const { competitionVideo } = require('./video');

async function competitionAnalytics(idOrSlug) {
  return remember(`competition:${idOrSlug}`, TTL.competition, async () => {
    const competitionService = require('../competitionService');
    const Match = require('../../models/Match');
    const MatchEvent = require('../../models/MatchEvent');
    const { Tournament, TournamentParticipant } = require('../../models');

    const standings = await competitionService.getStandings(idOrSlug);
    if (!standings) {
      const err = new Error('Competition not found');
      err.status = 404;
      throw err;
    }
    const tournamentId = standings.tournamentId;
    const meta = await Tournament.findByPk(tournamentId, { attributes: ['id', 'name', 'season', 'type', 'lifecycle'] });
    const matches = await Match.findAll({
      where: { tournamentId },
      attributes: ['id', 'status', 'scoreHome', 'scoreAway'],
      raw: true,
    });
    const matchIds = matches.map((row) => row.id);
    let goals = 0;
    let completed = 0;
    let upcoming = 0;
    for (const match of matches) {
      if (match.status === 'finished' || match.status === 'walkover') {
        completed += 1;
        goals += (Number(match.scoreHome) || 0) + (Number(match.scoreAway) || 0);
      } else if (match.status === 'scheduled' || match.status === 'live') {
        upcoming += 1;
      }
    }
    const cards = matchIds.length
      ? await MatchEvent.count({
          where: { matchId: { [Op.in]: matchIds }, type: { [Op.in]: ['yellow_card', 'red_card'] } },
        })
      : 0;
    const playerStats = await competitionService.playerStatsForCompetition(tournamentId);
    const players = playerStats?.players || [];
    const topScorers = [...players].sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 10);
    const topAssists = [...players].sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 10);
    const participants = await TournamentParticipant.count({ where: { tournamentId } });
    const video = await competitionVideo(tournamentId);
    return {
      competition: {
        id: meta?.id || tournamentId,
        name: meta?.name || null,
        season: meta?.season || playerStats?.season || null,
        type: meta?.type || standings.tournamentType,
      },
      participants,
      matches: matches.length,
      completedMatches: completed,
      upcomingMatches: upcoming,
      goals,
      goalsSource: 'Match.scoreHome + Match.scoreAway on finished matches',
      cards,
      cardsSource: 'MatchEvent yellow_card and red_card',
      topScorers: topScorers.map((row) => ({
        userId: row.userId,
        name: row.name,
        goals: row.goals,
        assists: row.assists,
        appearances: row.appearances,
      })),
      topAssists: topAssists.map((row) => ({
        userId: row.userId,
        name: row.name,
        assists: row.assists,
        goals: row.goals,
      })),
      standings: {
        source: 'competitionService.getStandings',
        rankingMode: standings.rankingMode,
        tieBreakers: standings.tieBreakers,
        rows: (standings.rows || []).map((row, index) => ({
          position: index + 1,
          userId: row.userId,
          name: [row.User?.firstName, row.User?.lastName].filter(Boolean).join(' ').trim() || null,
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        })),
      },
      viewership: video,
    };
  });
}

module.exports = {
  competitionAnalytics,
};
