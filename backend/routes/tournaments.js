const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createTournament,
  getTournaments,
  getTournament,
  joinTournament,
  leaveTournament,
  getLeaderboard,
  generateBracket,
  getBracket,
  updateMatchScore,
  getMatches,
  scheduleMatch,
  getTournamentStats,
  startTournamentAndGenerateMatches,
  updateMatchResultForTournament,
} = require('../controllers/tournaments');

// Tournament CRUD
router.post('/', auth, createTournament);
router.get('/', auth, getTournaments);
router.get('/:id', auth, getTournament);

// Participation
router.post('/:id/join', auth, joinTournament);
router.delete('/:id/leave', auth, leaveTournament);

// Leaderboard
router.get('/:id/leaderboard', auth, getLeaderboard);

// Bracket (knockout/cup)
router.post('/:id/bracket/generate', auth, generateBracket);
router.get('/:id/bracket', auth, getBracket);

// Matches
router.get('/:id/matches', auth, getMatches);
router.put('/matches/:matchId/score', auth, updateMatchScore);
router.put('/matches/:matchId/result', auth, updateMatchResultForTournament);
router.put('/matches/:matchId/schedule', auth, scheduleMatch);

// Start tournament and generate matches automatically
router.post('/:id/start', auth, startTournamentAndGenerateMatches);

// Statistics
router.get('/:id/stats', auth, getTournamentStats);

module.exports = router;