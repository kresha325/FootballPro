'use strict';

const logger = require('./logger');

// Ensure Match ↔ User / MatchScorer associations from models/index
require('../models');

const { Op } = require('sequelize');
const Match = require('../models/Match');
const MatchScorer = require('../models/MatchScorer');
const TournamentSquadMember = require('../models/TournamentSquadMember');
const { Tournament } = require('../models/Tournament');
const User = require('../models/User');

function personName(user, fallbackId) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return fallbackId != null ? `User #${fallbackId}` : '—';
}

/**
 * Recent matches for CV / profile:
 * - matches where user is home/away
 * - matches where user scored or assisted
 * - matches of clubs that nominated this athlete on the tournament squad
 */
async function loadRecentMatchesForUser(userId, limit = 12) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];

  const matchIdSet = new Set();

  try {
    const asSide = await Match.findAll({
      attributes: ['id'],
      where: {
        [Op.or]: [{ homeUserId: uid }, { awayUserId: uid }],
      },
      order: [['matchDate', 'DESC']],
      limit: 60,
    });
    asSide.forEach((m) => matchIdSet.add(m.id));
  } catch (err) {
    logger.warn('loadRecentMatchesForUser side:', err?.message || err);
  }

  let scorerRows = [];
  try {
    scorerRows = await MatchScorer.findAll({
      attributes: ['matchId', 'userId', 'assistUserId', 'goals'],
      where: {
        [Op.or]: [{ userId: uid }, { assistUserId: uid }],
      },
    });
    scorerRows.forEach((r) => {
      if (r.matchId != null) matchIdSet.add(r.matchId);
    });
  } catch (err) {
    logger.warn('loadRecentMatchesForUser scorers:', err?.message || err);
  }

  let squad = [];
  try {
    squad = await TournamentSquadMember.findAll({
      where: { athleteUserId: uid },
      attributes: ['tournamentId', 'clubUserId'],
    });
  } catch (err) {
    logger.warn('loadRecentMatchesForUser squad:', err?.message || err);
  }

  const clubByTournament = {};
  if (squad.length) {
    const orConditions = [];
    for (const s of squad) {
      const tid = Number(s.tournamentId);
      const clubId = Number(s.clubUserId);
      if (!Number.isFinite(tid) || !Number.isFinite(clubId)) continue;
      clubByTournament[tid] = clubId;
      orConditions.push({
        tournamentId: tid,
        [Op.or]: [{ homeUserId: clubId }, { awayUserId: clubId }],
      });
    }
    if (orConditions.length) {
      try {
        const clubMatches = await Match.findAll({
          attributes: ['id'],
          where: { [Op.or]: orConditions },
          order: [['matchDate', 'DESC']],
          limit: 80,
        });
        clubMatches.forEach((m) => matchIdSet.add(m.id));
      } catch (err) {
        logger.warn('loadRecentMatchesForUser club matches:', err?.message || err);
      }
    }
  }

  const ids = [...matchIdSet];
  if (!ids.length) return [];

  let matches = [];
  try {
    matches = await Match.findAll({
      where: { id: { [Op.in]: ids } },
      include: [
        { model: Tournament, attributes: ['id', 'name'], required: false },
        { model: User, as: 'homeUser', attributes: ['id', 'firstName', 'lastName'], required: false },
        { model: User, as: 'awayUser', attributes: ['id', 'firstName', 'lastName'], required: false },
        { model: MatchScorer, required: false },
      ],
      order: [['matchDate', 'DESC']],
      limit: Math.max(1, Math.min(Number(limit) || 12, 30)),
    });
  } catch (err) {
    // Fallback without MatchScorer include
    try {
      matches = await Match.findAll({
        where: { id: { [Op.in]: ids } },
        include: [
          { model: Tournament, attributes: ['id', 'name'], required: false },
          { model: User, as: 'homeUser', attributes: ['id', 'firstName', 'lastName'], required: false },
          { model: User, as: 'awayUser', attributes: ['id', 'firstName', 'lastName'], required: false },
        ],
        order: [['matchDate', 'DESC']],
        limit: Math.max(1, Math.min(Number(limit) || 12, 30)),
      });
    } catch (err2) {
      logger.warn('loadRecentMatchesForUser fetch:', err2?.message || err2);
      return [];
    }
  }

  const goalsByMatch = {};
  const assistsByMatch = {};
  for (const row of scorerRows) {
    const mid = row.matchId;
    if (mid == null) continue;
    if (Number(row.userId) === uid) {
      goalsByMatch[mid] = (goalsByMatch[mid] || 0) + (Number(row.goals) || 1);
    }
    if (Number(row.assistUserId) === uid) {
      assistsByMatch[mid] = (assistsByMatch[mid] || 0) + 1;
    }
  }

  // Also sum from included MatchScorers if present
  return matches.map((m) => {
    const j = typeof m.get === 'function' ? m.get({ plain: true }) : m;
    const homeName = personName(j.homeUser, j.homeUserId);
    const awayName = personName(j.awayUser, j.awayUserId);

    let mySide = null;
    if (Number(j.homeUserId) === uid) mySide = 'home';
    else if (Number(j.awayUserId) === uid) mySide = 'away';
    else {
      const clubId = clubByTournament[j.tournamentId];
      if (clubId != null) {
        if (Number(j.homeUserId) === Number(clubId)) mySide = 'home';
        else if (Number(j.awayUserId) === Number(clubId)) mySide = 'away';
      }
    }

    const opponent =
      mySide === 'home' ? awayName : mySide === 'away' ? homeName : `${homeName} vs ${awayName}`;
    const score =
      j.scoreHome != null && j.scoreAway != null ? `${j.scoreHome} : ${j.scoreAway}` : null;

    let goals = goalsByMatch[j.id] || 0;
    let assists = assistsByMatch[j.id] || 0;
    const scorerList = Array.isArray(j.MatchScorers)
      ? j.MatchScorers
      : Array.isArray(j.matchScorers)
        ? j.matchScorers
        : [];
    if ((!goals || !assists) && scorerList.length) {
      goals = 0;
      assists = 0;
      for (const row of scorerList) {
        if (Number(row.userId) === uid) goals += Number(row.goals) || 1;
        if (Number(row.assistUserId) === uid) assists += 1;
      }
    }

    const tournamentName = j.Tournament?.name || null;

    return {
      id: j.id,
      opponent,
      title: `${homeName} vs ${awayName}`,
      homeTeam: homeName,
      awayTeam: awayName,
      competition: tournamentName,
      tournament: tournamentName,
      score,
      result: score,
      date: j.matchDate,
      status: j.status,
      goals: goals > 0 ? goals : null,
      assists: assists > 0 ? assists : null,
    };
  });
}

module.exports = {
  loadRecentMatchesForUser,
};
