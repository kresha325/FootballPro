const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations, getCompareCandidates, comparePlayers } = require('../controllers/scouting');

router.get('/recommendations', auth, getRecommendations);
router.get('/candidates', auth, getCompareCandidates);
router.get('/compare', auth, comparePlayers);

module.exports = router;