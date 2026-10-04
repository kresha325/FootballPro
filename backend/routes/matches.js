const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createMatch, getMatches, updateMatchScore, getUserMatches, updateMatch, getMatchCenter } = require('../controllers/matches');

router.post('/', auth, createMatch);
router.get('/', auth.optionalAuth, getMatches);
router.get('/user/:userId', auth, getUserMatches);
router.get('/:id', auth.optionalAuth, getMatchCenter);
router.put('/:id/score', auth, updateMatchScore);
router.put('/:id', auth, updateMatch);

module.exports = router;
