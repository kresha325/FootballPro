const db = require('../models');
const Match = db.Match;
const Tournament = db.Tournament;
const { TournamentParticipant } = require('../models/Tournament');
const User = db.User;
const MatchScorer = db.MatchScorer;
const { saveMatchGoalEvents } = require('../utils/matchGoalEvents');
const { canManageTournamentMatches, canFillMatchStats } = require('../utils/matchPermissions');

// Update match details (edit)
exports.updateMatch = async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ msg: 'Match not found' });
    const { tournamentId, homeUserId, awayUserId, matchDate, round } = req.body;
    if (!tournamentId || !homeUserId || !awayUserId || !matchDate) {
      return res.status(400).json({ msg: 'Të gjitha fushat janë të detyrueshme: tournamentId, homeUserId, awayUserId, matchDate.' });
    }
    if (homeUserId === awayUserId) {
      return res.status(400).json({ msg: 'Nuk mund të zgjedhësh të njëjtin lojtar për të dy ekipet.' });
    }
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(400).json({ msg: 'Turneu nuk ekziston.' });

    const authz = canManageTournamentMatches(tournament, req.user);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    // If moving between tournaments, also must own the original
    if (Number(match.tournamentId) !== Number(tournamentId)) {
      const previous = await Tournament.findByPk(match.tournamentId);
      if (previous) {
        const prevAuth = canManageTournamentMatches(previous, req.user);
        if (!prevAuth.ok) return res.status(prevAuth.status).json({ msg: prevAuth.msg });
      }
    }

    match.tournamentId = tournamentId;
    match.homeUserId = homeUserId;
    match.awayUserId = awayUserId;
    match.matchDate = matchDate;
    match.round = round;
    await match.save();
    res.json(match);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
// GET matches for a specific user (as home or away)
exports.getUserMatches = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    let matches;
    try {
      matches = await Match.findAll({
        where: {
          [require('sequelize').Op.or]: [
            { homeUserId: userId },
            { awayUserId: userId }
          ]
        },
        include: [
          { model: db.Tournament, attributes: ['name'] },
          { model: db.User, as: 'homeUser', attributes: ['firstName', 'lastName'] },
          { model: db.User, as: 'awayUser', attributes: ['firstName', 'lastName'] },
        ],
        order: [['matchDate', 'DESC']]
      });
    } catch (err) {
      const message = err?.message || '';
      if (message.includes('MatchScorers') || message.includes('Tournaments') || message.includes('does not exist')) {
        matches = await Match.findAll({
          where: {
            [require('sequelize').Op.or]: [
              { homeUserId: userId },
              { awayUserId: userId }
            ]
          },
          order: [['matchDate', 'DESC']]
        });
      } else {
        throw err;
      }
    }
    res.json(matches);
  } catch (err) {
    console.error('Error in getUserMatches:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Ruaj golashënuesit për një ndeshje
exports.saveMatchScorers = async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId, 10);
    const { scorers, goalEvents } = req.body;
    const events = goalEvents || scorers;
    if (!Array.isArray(events)) return res.status(400).json({ msg: 'Invalid scorers' });

    const match = await Match.findByPk(matchId, { include: [{ model: Tournament }] });
    if (!match) return res.status(404).json({ msg: 'Match not found' });

    const authz = canFillMatchStats(match.Tournament, req.user, match);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    await saveMatchGoalEvents(matchId, events, match);

    res.json({ msg: 'Scorers saved' });
  } catch (err) {
    console.error('saveMatchScorers error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createMatch = async (req, res) => {
  try {
    const { tournamentId, homeUserId, awayUserId, matchDate, round } = req.body;
    if (!tournamentId || !homeUserId || !awayUserId || !matchDate) {
      return res.status(400).json({ msg: 'Të gjitha fushat janë të detyrueshme: tournamentId, homeUserId, awayUserId, matchDate.' });
    }
    if (Number(homeUserId) === Number(awayUserId)) {
      return res.status(400).json({ msg: 'Nuk mund të zgjedhësh të njëjtin lojtar për të dy ekipet.' });
    }
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(400).json({ msg: 'Turneu nuk ekziston.' });

    const authz = canManageTournamentMatches(tournament, req.user);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    const match = await Match.create({
      tournamentId,
      homeUserId,
      awayUserId,
      matchDate,
      round,
      status: 'scheduled',
    });
    res.status(201).json(match);
  } catch (err) {
    console.error('Error creating match:', err);
    res.status(500).json({ msg: 'Server error', error: err.message, details: err });
  }
};

exports.getMatches = async (req, res) => {
  try {
    let matches;
    try {
      matches = await Match.findAll({
        include: [
          { model: db.Tournament, attributes: ['name'] },
          { model: db.User, as: 'homeUser', attributes: ['firstName', 'lastName'] },
          { model: db.User, as: 'awayUser', attributes: ['firstName', 'lastName'] },
          {
            model: db.MatchScorer,
            include: [{ model: db.User, attributes: ['id', 'firstName', 'lastName'] }],
          },
        ],
      });
    } catch (err) {
      const message = err?.message || '';
      if (message.includes('MatchScorers') || message.includes('Tournaments') || message.includes('does not exist')) {
        matches = await Match.findAll({
          include: [
            { model: db.User, as: 'homeUser', attributes: ['firstName', 'lastName'] },
            { model: db.User, as: 'awayUser', attributes: ['firstName', 'lastName'] },
          ],
        });
      } else {
        throw err;
      }
    }
    res.json(matches);
  } catch (err) {
    console.error('Error in getMatches:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.updateMatchScore = async (req, res) => {
  try {
    const { scoreHome, scoreAway } = req.body;
    const match = await Match.findByPk(req.params.id, { include: [{ model: Tournament }] });
    if (!match) return res.status(404).json({ msg: 'Match not found' });

    const authz = canFillMatchStats(match.Tournament, req.user, match);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    match.scoreHome = scoreHome;
    match.scoreAway = scoreAway;
    match.status = 'finished';
    await match.save();

    // Rebuild standings from finished matches (do not increment again)
    if (match.tournamentId) {
      const participants = await TournamentParticipant.findAll({
        where: { tournamentId: match.tournamentId },
      });
      const stats = {};
      for (const p of participants) {
        stats[p.userId] = {
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        };
      }
      const finished = await Match.findAll({
        where: { tournamentId: match.tournamentId, status: 'finished' },
        attributes: ['homeUserId', 'awayUserId', 'scoreHome', 'scoreAway'],
      });
      for (const m of finished) {
        const h = m.homeUserId;
        const a = m.awayUserId;
        if (!stats[h] || !stats[a]) continue;
        const sh = Number(m.scoreHome) || 0;
        const sa = Number(m.scoreAway) || 0;
        stats[h].goalsFor += sh;
        stats[h].goalsAgainst += sa;
        stats[a].goalsFor += sa;
        stats[a].goalsAgainst += sh;
        if (sh > sa) {
          stats[h].wins += 1;
          stats[h].points += 3;
          stats[a].losses += 1;
        } else if (sa > sh) {
          stats[a].wins += 1;
          stats[a].points += 3;
          stats[h].losses += 1;
        } else {
          stats[h].draws += 1;
          stats[a].draws += 1;
          stats[h].points += 1;
          stats[a].points += 1;
        }
      }
      for (const p of participants) {
        const s = stats[p.userId] || {
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        };
        p.wins = s.wins;
        p.draws = s.draws;
        p.losses = s.losses;
        p.goalsFor = s.goalsFor;
        p.goalsAgainst = s.goalsAgainst;
        p.points = s.points;
        await p.save();
      }
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};