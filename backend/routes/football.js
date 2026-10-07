const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getFixtures, getStats, getTeams } = require('../controllers/football');

const footballLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { msg: 'Shumë kërkesa. Provo përsëri më vonë.' },
});

router.use(footballLimiter);
router.get('/fixtures', getFixtures);
router.get('/stats', getStats);
router.get('/teams', getTeams);

module.exports = router;
