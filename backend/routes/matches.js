const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createMatch, getMatches, updateMatchScore } = require('../controllers/matches');

router.post('/', auth, createMatch);
router.get('/', auth, getMatches);
router.put('/:id/score', auth, updateMatchScore);

module.exports = router;