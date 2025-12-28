const Match = require('../models/Match');
const { TournamentParticipant } = require('../models/Tournament');
const User = require('../models/User');

exports.createMatch = async (req, res) => {
  try {
    const { tournamentId, homeUserId, awayUserId, matchDate, round } = req.body;
    const match = await Match.create({
      tournamentId,
      homeUserId,
      awayUserId,
      matchDate,
      round,
    });
    res.status(201).json(match);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.findAll({
      include: [
        { model: require('../models/Tournament'), attributes: ['name'] },
        { model: User, as: 'homeUser', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'awayUser', attributes: ['firstName', 'lastName'] },
      ],
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
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