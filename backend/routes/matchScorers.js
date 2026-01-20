const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveMatchScorers } = require('../controllers/matches');

// POST /api/matches/:matchId/scorers
router.post('/:matchId/scorers', auth, saveMatchScorers);

module.exports = router;
