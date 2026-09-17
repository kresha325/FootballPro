const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations, getCompareCandidates, comparePlayers } = require('../controllers/scouting');

const SCOUTING_COMPARE_ROLES = new Set(['federation', 'scout', 'manager']);

function requireScoutingCompareRole(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!SCOUTING_COMPARE_ROLES.has(role)) {
    return res.status(403).json({
      msg: 'Raporti i Scouting është i disponueshëm vetëm për federation, scout dhe manager.',
    });
  }
  return next();
}

router.get('/recommendations', auth, getRecommendations);
router.get('/candidates', auth, requireScoutingCompareRole, getCompareCandidates);
router.get('/compare', auth, requireScoutingCompareRole, comparePlayers);

module.exports = router;