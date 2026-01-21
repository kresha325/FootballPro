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
    // Optionally: check if tournamentId exists
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(400).json({ msg: 'Turneu nuk ekziston.' });
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
const db = require('../models');
const Match = db.Match;
const Tournament = db.Tournament;
const { TournamentParticipant } = require('../models/Tournament');
const User = db.User;
const MatchScorer = db.MatchScorer;
// Ruaj golashënuesit për një ndeshje
exports.saveMatchScorers = async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { scorers } = req.body; // [{userId, goals}]
    if (!Array.isArray(scorers)) return res.status(400).json({ msg: 'Invalid scorers' });

    // Fshij të vjetrit
    await MatchScorer.destroy({ where: { matchId } });

    // Shto të rinjtë
    const toCreate = scorers.map(s => ({ matchId, userId: s.userId, goals: s.goals }));
    await MatchScorer.bulkCreate(toCreate);

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
    const match = await Match.create({
      tournamentId,
      homeUserId,
      awayUserId,
      matchDate,
      round,
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
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ msg: 'Match not found' });

    match.scoreHome = scoreHome;
    match.scoreAway = scoreAway;
    match.status = 'finished';
    await match.save();

    // Update participant stats
    const homeParticipant = await TournamentParticipant.findOne({ where: { tournamentId: match.tournamentId, userId: match.homeUserId } });
    const awayParticipant = await TournamentParticipant.findOne({ where: { tournamentId: match.tournamentId, userId: match.awayUserId } });

    if (homeParticipant) {
      homeParticipant.goalsFor += scoreHome;
      homeParticipant.goalsAgainst += scoreAway;
      if (scoreHome > scoreAway) {
        homeParticipant.wins += 1;
        homeParticipant.points += 3;
      } else if (scoreHome === scoreAway) {
        homeParticipant.draws += 1;
        homeParticipant.points += 1;
      } else {
        homeParticipant.losses += 1;
      }
      await homeParticipant.save();
    }

    if (awayParticipant) {
      awayParticipant.goalsFor += scoreAway;
      awayParticipant.goalsAgainst += scoreHome;
      if (scoreAway > scoreHome) {
        awayParticipant.wins += 1;
        awayParticipant.points += 3;
      } else if (scoreAway === scoreHome) {
        awayParticipant.draws += 1;
        awayParticipant.points += 1;
      } else {
        awayParticipant.losses += 1;
      }
      await awayParticipant.save();
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};