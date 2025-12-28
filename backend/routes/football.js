const express = require('express');
const router = express.Router();
const { getFixtures, getStats, getTeams } = require('../controllers/football');

router.get('/fixtures', getFixtures);
router.get('/stats', getStats);
router.get('/teams', getTeams);

module.exports = router;