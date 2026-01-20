const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createMatch, getMatches, updateMatchScore, getUserMatches, updateMatch } = require('../controllers/matches');


router.post('/', auth, createMatch);
router.get('/', auth, getMatches);
router.get('/user/:userId', auth, getUserMatches);
router.put('/:id/score', auth, updateMatchScore);
router.put('/:id', auth, updateMatch);

module.exports = router;