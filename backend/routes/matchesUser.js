const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createMatch, getMatches, getUserMatchStats } = require('../controllers/matchesUser');

router.post('/', auth, createMatch);
router.get('/', auth, getMatches);

// Endpoint për statistika të përdoruesit
router.get('/stats', auth, getUserMatchStats);

module.exports = router;
