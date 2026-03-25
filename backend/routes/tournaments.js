const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createTournament,
  getTournaments,
  getTrendingTournaments,
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
  acceptParticipant,
  rejectParticipant,
  removeParticipant,
} = require('../controllers/tournaments');

// Tournament CRUD
router.post('/', auth, createTournament);
router.get('/', auth, getTournaments);
// Trending (auth required)
router.get('/trending', auth, getTrendingTournaments);
router.get('/:id', auth, getTournament);
router.delete('/:id', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.creatorId !== req.user.id) return res.status(403).json({ error: 'Nuk keni të drejtë të fshini këtë turne.' });
    await tournament.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Nuk u fshi dot turneu.' });
  }
});

// Participation
router.post('/:id/join', auth, joinTournament);
router.delete('/:id/leave', auth, leaveTournament);

// Accept, reject, remove participant
router.put('/:id/participants/:userId/accept', auth, acceptParticipant);
router.put('/:id/participants/:userId/reject', auth, rejectParticipant);
router.delete('/:id/participants/:userId', auth, removeParticipant);

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