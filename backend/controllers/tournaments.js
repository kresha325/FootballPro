const { Tournament, TournamentParticipant } = require('../models/Tournament');
const Match = require('../models/Match');
const Bracket = require('../models/Bracket');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');
const { notifyMessage } = require('./notifications');

exports.createTournament = async (req, res) => {
  try {
    const { name, description, type, startDate, endDate, maxParticipants } = req.body;
    const tournament = await Tournament.create({
      name,
      description,
      type,
      startDate,
      endDate,
      maxParticipants,
      creatorId: req.user.id,
    });
    res.status(201).json(tournament);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'participants', through: { attributes: [] } },
      ],
    });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'participants', through: { attributes: ['points', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst'] } },
        { model: Match, include: [{ model: User, as: 'homeUser' }, { model: User, as: 'awayUser' }] },
      ],
    });
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.joinTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.status !== 'open') return res.status(400).json({ msg: 'Tournament not open for joining' });

    const participants = await TournamentParticipant.findAll({ where: { tournamentId: req.params.id } });
    if (participants.length >= tournament.maxParticipants) return res.status(400).json({ msg: 'Tournament full' });

    await TournamentParticipant.create({ tournamentId: req.params.id, userId: req.user.id });
    res.json({ msg: 'Joined tournament' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto', 'position'] }],
        },
      ],
      order: [['points', 'DESC'], ['wins', 'DESC'], ['goalsFor', 'DESC']],
    });
    res.json(participants);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Generate bracket for knockout tournament
exports.generateBracket = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can generate bracket' });
    }
    if (tournament.type !== 'knockout' && tournament.type !== 'cup') {
      return res.status(400).json({ msg: 'Only knockout/cup tournaments have brackets' });
    }

    // Get all participants
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
      include: [{ model: User }],
    });

    if (participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants' });
    }

    // Shuffle and pair participants
    const shuffled = participants.sort(() => 0.5 - Math.random());
    const round = 1;
    const matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const match = await Match.create({
          tournamentId: req.params.id,
          homeUserId: shuffled[i].userId,
          awayUserId: shuffled[i + 1].userId,
          round,
          status: 'scheduled',
        });

        await Bracket.create({
          tournamentId: req.params.id,
          round,
          position: Math.floor(i / 2),
          matchId: match.id,
        });

        matches.push(match);
      }
    }

    await tournament.update({ status: 'ongoing' });
    res.json({ msg: 'Bracket generated', matches });
  } catch (err) {
    console.error('Generate bracket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get bracket structure
exports.getBracket = async (req, res) => {
  try {
    const brackets = await Bracket.findAll({
      where: { tournamentId: req.params.id },
      include: [
        {
          model: Match,
          include: [
            {
              model: User,
              as: 'homeUser',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, attributes: ['profilePhoto'] }],
            },
            {
              model: User,
              as: 'awayUser',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, attributes: ['profilePhoto'] }],
            },
          ],
        },
      ],
      order: [['round', 'ASC'], ['position', 'ASC']],
    });

    // Group by rounds
    const rounds = {};
    brackets.forEach(bracket => {
      if (!rounds[bracket.round]) {
        rounds[bracket.round] = [];
      }
      rounds[bracket.round].push(bracket);
    });

    res.json(rounds);
  } catch (err) {
    console.error('Get bracket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update match score (live)
exports.updateMatchScore = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { scoreHome, scoreAway, status } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }],
    });

    if (!match) return res.status(404).json({ msg: 'Match not found' });

    // Only creator or participants can update
    if (
      match.Tournament.creatorId !== req.user.id &&
      match.homeUserId !== req.user.id &&
      match.awayUserId !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await match.update({ scoreHome, scoreAway, status });

    // If match finished, update standings
    if (status === 'finished') {
      await updateStandings(match);
      
      // For knockout, create next round match
      if (match.Tournament.type === 'knockout' || match.Tournament.type === 'cup') {
        await progressToNextRound(match);
      }
    }

    res.json(match);
  } catch (err) {
    console.error('Update match score error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Helper: Update standings after match
async function updateStandings(match) {
  const { tournamentId, homeUserId, awayUserId, scoreHome, scoreAway } = match;

  const homeParticipant = await TournamentParticipant.findOne({
    where: { tournamentId, userId: homeUserId },
  });
  const awayParticipant = await TournamentParticipant.findOne({
    where: { tournamentId, userId: awayUserId },
  });

  if (!homeParticipant || !awayParticipant) return;

  // Update goals
  homeParticipant.goalsFor += scoreHome;
  homeParticipant.goalsAgainst += scoreAway;
  awayParticipant.goalsFor += scoreAway;
  awayParticipant.goalsAgainst += scoreHome;

  // Update points and W/D/L
  if (scoreHome > scoreAway) {
    homeParticipant.wins += 1;
    homeParticipant.points += 3;
    awayParticipant.losses += 1;
  } else if (scoreHome < scoreAway) {
    awayParticipant.wins += 1;
    awayParticipant.points += 3;
    homeParticipant.losses += 1;
  } else {
    homeParticipant.draws += 1;
    homeParticipant.points += 1;
    awayParticipant.draws += 1;
    awayParticipant.points += 1;
  }

  await homeParticipant.save();
  await awayParticipant.save();
}

// Helper: Progress winner to next round
async function progressToNextRound(match) {
  const { scoreHome, scoreAway, round, tournamentId } = match;
  const winnerId = scoreHome > scoreAway ? match.homeUserId : match.awayUserId;

  // Check if there's a next round match position
  const currentBracket = await Bracket.findOne({ where: { matchId: match.id } });
  const nextRound = round + 1;
  const nextPosition = Math.floor(currentBracket.position / 2);

  // Check if next round match exists
  let nextMatch = await Match.findOne({
    where: { tournamentId, round: nextRound },
    include: [{ model: Bracket, where: { position: nextPosition } }],
  });

  if (!nextMatch) {
    // Create next round match (waiting for opponent)
    nextMatch = await Match.create({
      tournamentId,
      round: nextRound,
      homeUserId: winnerId,
      status: 'scheduled',
    });

    await Bracket.create({
      tournamentId,
      round: nextRound,
      position: nextPosition,
      matchId: nextMatch.id,
    });
  } else {
    // Add winner as opponent
    if (!nextMatch.homeUserId) {
      await nextMatch.update({ homeUserId: winnerId });
    } else if (!nextMatch.awayUserId) {
      await nextMatch.update({ awayUserId: winnerId });
    }
  }
}

// Get tournament matches
exports.getMatches = async (req, res) => {
  try {
    const { status, round } = req.query;
    const where = { tournamentId: req.params.id };

    if (status) where.status = status;
    if (round) where.round = parseInt(round);

    const matches = await Match.findAll({
      where,
      include: [
        {
          model: User,
          as: 'homeUser',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
        {
          model: User,
          as: 'awayUser',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
      order: [['round', 'ASC'], ['matchDate', 'ASC']],
    });

    res.json(matches);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Schedule match
exports.scheduleMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { matchDate } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }],
    });

    if (!match) return res.status(404).json({ msg: 'Match not found' });
    if (match.Tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only creator can schedule matches' });
    }

    await match.update({ matchDate });

    // Notify participants
    if (match.homeUserId) {
      await notifyMessage(
        match.homeUserId,
        req.user.id,
        `Your match has been scheduled for ${new Date(matchDate).toLocaleString()}`
      );
    }
    if (match.awayUserId) {
      await notifyMessage(
        match.awayUserId,
        req.user.id,
        `Your match has been scheduled for ${new Date(matchDate).toLocaleString()}`
      );
    }

    res.json(match);
  } catch (err) {
    console.error('Schedule match error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get tournament statistics
exports.getTournamentStats = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });

    const participants = await TournamentParticipant.findAll({
      where: { tournamentId: req.params.id },
    });

    const matches = await Match.findAll({
      where: { tournamentId: req.params.id },
    });

    const totalGoals = participants.reduce((sum, p) => sum + p.goalsFor, 0);
    const finishedMatches = matches.filter(m => m.status === 'finished').length;

    // Top scorer
    const topScorer = participants.reduce((max, p) => 
      p.goalsFor > (max?.goalsFor || 0) ? p : max
    , null);

    // Top team
    const topTeam = participants.reduce((max, p) => 
      p.points > (max?.points || 0) ? p : max
    , null);

    const stats = {
      totalParticipants: participants.length,
      totalMatches: matches.length,
      finishedMatches,
      totalGoals,
      avgGoalsPerMatch: finishedMatches > 0 ? (totalGoals / finishedMatches).toFixed(2) : 0,
      topScorerId: topScorer?.userId,
      topScorerGoals: topScorer?.goalsFor || 0,
      topTeamId: topTeam?.userId,
      topTeamPoints: topTeam?.points || 0,
    };

    res.json(stats);
  } catch (err) {
    console.error('Get tournament stats error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Leave tournament
exports.leaveTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ msg: 'Tournament not found' });
    if (tournament.status !== 'open') {
      return res.status(400).json({ msg: 'Cannot leave ongoing tournament' });
    }

    await TournamentParticipant.destroy({
      where: {
        tournamentId: req.params.id,
        userId: req.user.id,
      },
    });

    res.json({ msg: 'Left tournament' });
  } catch (err) {
    console.error('Leave tournament error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Start tournament and generate matches
exports.startTournamentAndGenerateMatches = async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await Tournament.findByPk(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    if (tournament.creatorId !== req.user.id) {
      return res.status(403).json({ msg: 'Only tournament creator can start it' });
    }

    if (tournament.status !== 'open') {
      return res.status(400).json({ msg: 'Tournament already started or finished' });
    }

    // Get participants
    const participants = await TournamentParticipant.findAll({
      where: { tournamentId },
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }]
    });

    if (participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants' });
    }

    // Change tournament status
    tournament.status = 'ongoing';
    await tournament.save();

    const matches = [];
    const participantIds = participants.map(p => p.userId);

    if (tournament.type === 'league') {
      // League: Everyone plays everyone
      for (let i = 0; i < participantIds.length; i++) {
        for (let j = i + 1; j < participantIds.length; j++) {
          matches.push({
            tournamentId,
            homeUserId: participantIds[i],
            awayUserId: participantIds[j],
            status: 'scheduled',
            round: 1,
            matchDate: new Date(Date.now() + (matches.length * 24 * 60 * 60 * 1000)) // Space out by days
          });
        }
      }
    } else if (tournament.type === 'knockout' || tournament.type === 'cup') {
      // Knockout: Bracket style (Round of 16, Quarters, Semis, Final)
      // Shuffle participants for random bracket
      const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
      
      // Round 1: Pair up all participants
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          matches.push({
            tournamentId,
            homeUserId: shuffled[i],
            awayUserId: shuffled[i + 1],
            status: 'scheduled',
            round: 1,
            matchDate: new Date(Date.now() + (Math.floor(i / 2) * 24 * 60 * 60 * 1000))
          });
        }
      }

      // If odd number, one team gets a bye (advances automatically)
      if (shuffled.length % 2 !== 0) {
        // The last team gets a bye - we'll create a "placeholder" match
        console.log(`Team ${shuffled[shuffled.length - 1]} gets a bye to round 2`);
      }
    }

    // Create all matches in database
    const createdMatches = await Match.bulkCreate(matches);

    // Notify all participants
    for (const participant of participants) {
      await notifyMessage(
        participant.userId,
        'Tournament Started!',
        `${tournament.name} has started! Check your match schedule.`,
        `/tournaments/${tournamentId}`
      );
    }

    res.json({
      msg: 'Tournament started successfully',
      tournament,
      matchesCreated: createdMatches.length,
      matches: createdMatches
    });
  } catch (err) {
    console.error('Start tournament error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Update match result (affects tournament standings)
exports.updateMatchResultForTournament = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { scoreHome, scoreAway } = req.body;

    const match = await Match.findByPk(matchId, {
      include: [{ model: Tournament }]
    });

    if (!match) {
      return res.status(404).json({ msg: 'Match not found' });
    }

    if (!match.Tournament) {
      return res.status(400).json({ msg: 'Match not part of a tournament' });
    }

    // Update match scores and status
    match.scoreHome = scoreHome;
    match.scoreAway = scoreAway;
    match.status = 'finished';
    await match.save();

    // Update tournament participant stats (for league type)
    if (match.Tournament.type === 'league') {
      const homeParticipant = await TournamentParticipant.findOne({
        where: { tournamentId: match.tournamentId, userId: match.homeUserId }
      });

      const awayParticipant = await TournamentParticipant.findOne({
        where: { tournamentId: match.tournamentId, userId: match.awayUserId }
      });

      if (homeParticipant && awayParticipant) {
        // Update goals
        homeParticipant.goalsFor += scoreHome;
        homeParticipant.goalsAgainst += scoreAway;
        awayParticipant.goalsFor += scoreAway;
        awayParticipant.goalsAgainst += scoreHome;

        // Update wins/draws/losses and points
        if (scoreHome > scoreAway) {
          homeParticipant.wins += 1;
          homeParticipant.points += 3;
          awayParticipant.losses += 1;
        } else if (scoreAway > scoreHome) {
          awayParticipant.wins += 1;
          awayParticipant.points += 3;
          homeParticipant.losses += 1;
        } else {
          homeParticipant.draws += 1;
          homeParticipant.points += 1;
          awayParticipant.draws += 1;
          awayParticipant.points += 1;
        }

        await homeParticipant.save();
        await awayParticipant.save();
      }
    }

    // For knockout, determine winner and create next round match
    if (match.Tournament.type === 'knockout' || match.Tournament.type === 'cup') {
      const winnerId = scoreHome > scoreAway ? match.homeUserId : match.awayUserId;
      
      // Check if there are other matches in current round that are finished
      const currentRoundMatches = await Match.findAll({
        where: {
          tournamentId: match.tournamentId,
          round: match.round
        }
      });

      const allRoundFinished = currentRoundMatches.every(m => m.status === 'finished');

      if (allRoundFinished && currentRoundMatches.length >= 2) {
        // Create next round matches
        const winners = currentRoundMatches.map(m => 
          m.scoreHome > m.scoreAway ? m.homeUserId : m.awayUserId
        );

        const nextRoundMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (i + 1 < winners.length) {
            nextRoundMatches.push({
              tournamentId: match.tournamentId,
              homeUserId: winners[i],
              awayUserId: winners[i + 1],
              status: 'scheduled',
              round: match.round + 1,
              matchDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
            });
          }
        }

        if (nextRoundMatches.length > 0) {
          await Match.bulkCreate(nextRoundMatches);
        } else if (winners.length === 1) {
          // Tournament finished - we have a winner!
          match.Tournament.status = 'finished';
          await match.Tournament.save();
          
          await notifyMessage(
            winnerId,
            'Tournament Winner! 🏆',
            `Congratulations! You won ${match.Tournament.name}!`,
            `/tournaments/${match.tournamentId}`
          );
        }
      }
    }

    res.json({
      msg: 'Match result updated',
      match
    });
  } catch (err) {
    console.error('Update match result error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};