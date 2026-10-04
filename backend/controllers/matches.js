const db = require('../models');
const Match = db.Match;
const Tournament = db.Tournament;
const User = db.User;
const MatchScorer = db.MatchScorer;
const { saveMatchGoalEvents } = require('../utils/matchGoalEvents');
const { canManageTournamentMatches, canFillMatchStats } = require('../utils/matchPermissions');
const { notifyMatchParticipants } = require('../utils/matchNotifications');
const competitionService = require('../services/competitionService');

// Update match details (edit)
exports.updateMatch = async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ msg: 'Match not found' });
    const { tournamentId, homeUserId, awayUserId, matchDate, round, stadiumId } = req.body;
    if (!tournamentId || !homeUserId || !awayUserId || !matchDate) {
      return res.status(400).json({ msg: 'Të gjitha fushat janë të detyrueshme: tournamentId, homeUserId, awayUserId, matchDate.' });
    }
    if (!stadiumId) {
      return res.status(400).json({ msg: 'Zgjidh stadiumin ku zhvillohet ndeshja.', field: 'stadiumId' });
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

    const stadium = await db.Stadium.findByPk(stadiumId);
    if (!stadium) return res.status(400).json({ msg: 'Stadiumi nuk ekziston.', field: 'stadiumId' });

    try {
      await competitionService.assertManualFixture({
        tournament,
        homeUserId,
        awayUserId,
        round,
        groupName: req.body.groupName,
        matchDate,
        excludeMatchId: match.id,
      });
    } catch (guardErr) {
      return res.status(guardErr.status || 400).json({ msg: guardErr.message });
    }

    match.tournamentId = tournamentId;
    match.homeUserId = homeUserId;
    match.awayUserId = awayUserId;
    match.matchDate = matchDate;
    match.round = round;
    match.stadiumId = stadiumId;
    await match.save();

    try {
      await notifyMatchParticipants(match, tournament, { kind: 'updated' });
    } catch (notifyErr) {
      console.warn('updateMatch notify:', notifyErr?.message || notifyErr);
    }

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

    try {
      await notifyMatchParticipants(match, match.Tournament, { kind: 'stats' });
    } catch (notifyErr) {
      console.warn('saveMatchScorers notify:', notifyErr?.message || notifyErr);
    }

    res.json({ msg: 'Scorers saved' });
  } catch (err) {
    console.error('saveMatchScorers error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createMatch = async (req, res) => {
  try {
    const { tournamentId, homeUserId, awayUserId, matchDate, round, stadiumId } = req.body;
    if (!tournamentId || !homeUserId || !awayUserId || !matchDate) {
      return res.status(400).json({ msg: 'Të gjitha fushat janë të detyrueshme: tournamentId, homeUserId, awayUserId, matchDate.' });
    }
    if (!stadiumId) {
      return res.status(400).json({ msg: 'Zgjidh stadiumin ku zhvillohet ndeshja.', field: 'stadiumId' });
    }
    if (Number(homeUserId) === Number(awayUserId)) {
      return res.status(400).json({ msg: 'Nuk mund të zgjedhësh të njëjtin lojtar për të dy ekipet.' });
    }
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(400).json({ msg: 'Turneu nuk ekziston.' });

    const authz = canManageTournamentMatches(tournament, req.user);
    if (!authz.ok) return res.status(authz.status).json({ msg: authz.msg });

    const stadium = await db.Stadium.findByPk(stadiumId);
    if (!stadium) return res.status(400).json({ msg: 'Stadiumi nuk ekziston.', field: 'stadiumId' });

    try {
      await competitionService.assertManualFixture({
        tournament,
        homeUserId,
        awayUserId,
        round,
        groupName: req.body.groupName,
        matchDate,
      });
    } catch (guardErr) {
      return res.status(guardErr.status || 400).json({ msg: guardErr.message });
    }

    const match = await Match.create({
      tournamentId,
      homeUserId,
      awayUserId,
      matchDate,
      round,
      stadiumId,
      status: 'scheduled',
      stage: req.body.stage || (req.body.groupName ? 'group' : null),
      groupName: req.body.groupName || null,
      venue: req.body.venue || stadium.name,
    });
    match.publicSlug = `m-${match.id}`;
    await match.save();

    try {
      await notifyMatchParticipants(match, tournament, { kind: 'created' });
    } catch (notifyErr) {
      console.warn('createMatch notify:', notifyErr?.message || notifyErr);
    }

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
          { model: db.Stadium, as: 'Stadium', attributes: ['id', 'name', 'city'], required: false },
          {
            model: db.MatchScorer,
            include: [{ model: db.User, attributes: ['id', 'firstName', 'lastName'] }],
          },
        ],
      });
    } catch (err) {
      const message = err?.message || '';
      if (message.includes('MatchScorers') || message.includes('Tournaments') || message.includes('does not exist') || message.includes('stadium')) {
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
    const result = await competitionService.recordOfficialResult({
      matchId: req.params.id,
      user: req.user,
      payload: { ...req.body, status: 'finished' },
    });
    try {
      await notifyMatchParticipants(result.match, result.tournament, { kind: 'stats' });
    } catch (notifyErr) {
      console.warn('updateMatchScore notify:', notifyErr?.message || notifyErr);
    }
    res.json(result.match);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.getMatchCenter = async (req, res) => {
  try {
    const payload = await competitionService.publicMatchPayload(req.params.id);
    if (!payload) return res.status(404).json({ msg: 'Match not found' });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const payload = await competitionService.calendarMatches(req.query || {});
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
};