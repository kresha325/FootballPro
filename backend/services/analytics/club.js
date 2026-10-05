'use strict';

const { Op } = require('sequelize');
const { createdBetween } = require('./formulas');
const { remember, TTL } = require('./cache');
const { loadOfficialTotalsForUsers } = require('../../utils/playerProfileCv');

function finished(status) {
  return status === 'finished' || status === 'walkover';
}

function clubMatchResult(match, clubId) {
  if (!finished(match.status)) return null;
  if (match.winnerUserId) {
    return Number(match.winnerUserId) === Number(clubId) ? 'win' : 'loss';
  }
  const home = Number(match.scoreHome);
  const away = Number(match.scoreAway);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  const mine = Number(match.homeUserId) === Number(clubId) ? home : away;
  const theirs = Number(match.homeUserId) === Number(clubId) ? away : home;
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'loss';
  return 'draw';
}

async function clubAnalytics(clubId, filters = {}) {
  const id = Number(clubId);
  return remember(`club:${id}:${filters.season || ''}:${filters.competitionId || ''}:${filters.from || ''}`, TTL.club, async () => {
    const ClubMember = require('../../models/ClubMember');
    const ClubRosterRequest = require('../../models/ClubRosterRequest');
    const Match = require('../../models/Match');
    const { Tournament, TournamentParticipant } = require('../../models');
    const competitionService = require('../competitionService');

    const between = createdBetween(filters);
    const matchWhere = {
      [Op.or]: [{ homeUserId: id }, { awayUserId: id }],
    };
    if (between) matchWhere.matchDate = between;
    if (filters.competitionId) matchWhere.tournamentId = Number(filters.competitionId);
    const include = [
      {
        model: Tournament,
        attributes: ['id', 'name', 'season', 'lifecycle'],
        required: Boolean(filters.season),
        ...(filters.season ? { where: { season: String(filters.season) } } : {}),
      },
    ];

    const [squadSize, pendingRequests, joinedInRange, matches, memberships] = await Promise.all([
      ClubMember.count({ where: { clubId: id, status: 'approved' } }),
      ClubRosterRequest.count({ where: { clubId: id, status: 'pending' } }),
      ClubMember.count({
        where: {
          clubId: id,
          status: 'approved',
          ...(between ? { createdAt: between } : {}),
        },
      }),
      Match.findAll({
        where: matchWhere,
        attributes: ['id', 'status', 'scoreHome', 'scoreAway', 'homeUserId', 'awayUserId', 'winnerUserId', 'matchDate', 'tournamentId'],
        include,
      }),
      ClubMember.findAll({
        where: { clubId: id, status: 'approved' },
        attributes: ['athleteId'],
        limit: 40,
        raw: true,
      }),
    ]);

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;
    let completed = 0;
    let upcoming = 0;
    for (const match of matches) {
      const plain = match.get ? match.get({ plain: true }) : match;
      if (plain.status === 'scheduled') upcoming += 1;
      const result = clubMatchResult(plain, id);
      if (!result) continue;
      completed += 1;
      if (result === 'win') wins += 1;
      else if (result === 'draw') draws += 1;
      else losses += 1;
      const home = Number(plain.scoreHome) || 0;
      const away = Number(plain.scoreAway) || 0;
      if (Number(plain.homeUserId) === id) {
        goalsScored += home;
        goalsConceded += away;
      } else {
        goalsScored += away;
        goalsConceded += home;
      }
    }

    const season = filters.season || null;
    const participants = await TournamentParticipant.findAll({
      where: { userId: id },
      include: [{ model: Tournament, attributes: ['id', 'name', 'season', 'lifecycle', 'status'], required: true }],
      limit: 8,
    });
    const positions = [];
    for (const participant of participants) {
      const tournament = participant.Tournament;
      if (!tournament) continue;
      if (season && String(tournament.season) !== String(season)) continue;
      if (filters.competitionId && Number(tournament.id) !== Number(filters.competitionId)) continue;
      const lifecycle = String(tournament.lifecycle || tournament.status || '');
      if (!season && !['active', 'in_progress', 'registration'].includes(lifecycle) && positions.length >= 3) continue;
      let table = null;
      try {
        table = await competitionService.getStandings(tournament.id);
      } catch (err) {
        console.warn('club standings:', err?.message || err);
        continue;
      }
      const index = (table?.rows || []).findIndex((row) => Number(row.userId) === id);
      if (index < 0) continue;
      const row = table.rows[index];
      positions.push({
        tournamentId: tournament.id,
        name: tournament.name,
        season: tournament.season,
        position: index + 1,
        played: row.played,
        points: row.points,
        source: 'competitionService.getStandings',
      });
    }

    const athleteIds = memberships.map((row) => Number(row.athleteId)).filter((value) => value > 0);
    const User = require('../../models/User');
    const [totals, users] = await Promise.all([
      athleteIds.length ? loadOfficialTotalsForUsers(athleteIds) : {},
      athleteIds.length
        ? User.findAll({ where: { id: { [Op.in]: athleteIds } }, attributes: ['id', 'firstName', 'lastName'], raw: true })
        : [],
    ]);
    const names = Object.fromEntries(users.map((user) => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ').trim()]));
    const players = athleteIds.map((athleteId) => ({
      userId: athleteId,
      name: names[athleteId] || null,
      appearances: totals[athleteId]?.appearances || 0,
      goals: totals[athleteId]?.goals || 0,
      assists: totals[athleteId]?.assists || 0,
      minutes: totals[athleteId]?.minutes || 0,
      rating: totals[athleteId]?.rating ?? null,
    }));
    players.sort((a, b) => b.goals - a.goals || b.assists - a.assists);

    return {
      squadSize,
      squadSizeLabel: 'Current approved roster. Not filtered by the date range.',
      pendingRequests,
      rosterJoinsInRange: between ? joinedInRange : null,
      matches: matches.length,
      completedMatches: completed,
      upcomingMatches: upcoming,
      wins,
      draws,
      losses,
      goalsScored,
      goalsConceded,
      positions,
      players,
      sources: {
        results: 'Match scores',
        position: 'competitionService.getStandings',
        players: 'player match aggregation',
      },
    };
  });
}

async function assertClubAccess(user, clubId) {
  if (Number(user?.id) === Number(clubId)) return true;
  const ClubStaff = require('../../models/ClubStaff');
  const staff = await ClubStaff.findOne({
    where: { clubId: Number(clubId), staffId: Number(user?.id) },
    attributes: ['id'],
  });
  return Boolean(staff);
}

module.exports = {
  clubAnalytics,
  clubMatchResult,
  assertClubAccess,
};
