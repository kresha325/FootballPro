const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Tournament } = require('../models/Tournament');
const {
  createTournament,
  updateTournament,
  getTournaments,
  getTrendingTournaments,
  getTournament,
  joinTournament,
  leaveTournament,
  getLeaderboard,
  getStandings,
  generateBracket,
  getBracket,
  updateMatchScore,
  getMatches,
  getTournamentMatchDetail,
  scheduleMatch,
  getTournamentStats,
  startTournamentAndGenerateMatches,
  updateMatchResultForTournament,
  acceptParticipant,
  rejectParticipant,
  removeParticipant,
  setTournamentSquad,
  getTournamentSquad,
  getCompetitionPlayerStats,
  addTournamentMatchEvent,
  setTournamentMatchLineup,
  saveTournamentPlayerStats,
  transitionCompetition,
} = require('../controllers/tournaments');

// Tournament CRUD
router.post('/', auth, createTournament);
router.put('/:id', auth, updateTournament);
router.get('/', auth.optionalAuth, getTournaments);
router.get('/trending', auth.optionalAuth, getTrendingTournaments);

router.delete('/:id', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && tournament.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Nuk keni të drejtë të fshini këtë turne.' });
    }
    const Match = require('../models/Match');
    const MatchScorer = require('../models/MatchScorer');
    const Bracket = require('../models/Bracket');
    const { TournamentParticipant } = require('../models/Tournament');
    const { Op } = require('sequelize');
    const matches = await Match.findAll({ where: { tournamentId: tournament.id }, attributes: ['id'] });
    const matchIds = matches.map((m) => m.id);
    await Bracket.destroy({ where: { tournamentId: tournament.id } });
    if (matchIds.length) {
      await MatchScorer.destroy({ where: { matchId: { [Op.in]: matchIds } } });
      await Match.destroy({ where: { tournamentId: tournament.id } });
    }
    await TournamentParticipant.destroy({ where: { tournamentId: tournament.id } });
    await tournament.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('delete tournament:', err);
    res.status(500).json({ error: 'Nuk u fshi dot turneu.' });
  }
});

// Participation
router.post('/:id/join', auth, joinTournament);
router.get('/:id/squad', auth, getTournamentSquad);
router.put('/:id/squad', auth, setTournamentSquad);
router.delete('/:id/leave', auth, leaveTournament);

// Accept, reject, remove participant
router.put('/:id/participants/:userId/accept', auth, acceptParticipant);
router.put('/:id/participants/:userId/reject', auth, rejectParticipant);
router.delete('/:id/participants/:userId', auth, removeParticipant);

// Leaderboard & standings (tabela sipas rregullave të turneut)
router.get('/:id/leaderboard', auth.optionalAuth, getLeaderboard);
router.get('/:id/standings', auth.optionalAuth, getStandings);
router.get('/:id/player-stats', auth.optionalAuth, getCompetitionPlayerStats);
router.post('/:id/lifecycle', auth, transitionCompetition);

router.get('/:id', auth.optionalAuth, getTournament);

// Bracket (knockout/cup)
router.post('/:id/bracket/generate', auth, generateBracket);
router.get('/:id/bracket', auth.optionalAuth, getBracket);

// Matches (detail para listës që të mos përplaset me segmente të tjera)
router.get('/:id/matches/:matchId', auth.optionalAuth, getTournamentMatchDetail);
router.get('/:id/matches', auth.optionalAuth, getMatches);
router.put('/matches/:matchId/score', auth, updateMatchScore);
router.put('/matches/:matchId/result', auth, updateMatchResultForTournament);
router.put('/matches/:matchId/schedule', auth, scheduleMatch);
router.post('/matches/:matchId/events', auth, addTournamentMatchEvent);
router.put('/matches/:matchId/lineup', auth, setTournamentMatchLineup);
router.put('/matches/:matchId/player-stats', auth, saveTournamentPlayerStats);

// Start tournament and generate matches automatically
router.post('/:id/start', auth, startTournamentAndGenerateMatches);

// Statistics
router.get('/:id/stats', auth.optionalAuth, getTournamentStats);

module.exports = router;