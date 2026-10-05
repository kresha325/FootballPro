const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getRecommendations,
  getCompareCandidates,
  comparePlayers,
  getPlayers,
  getPlayer,
  getDashboard,
  getMeta,
  getPreferences,
  savePreferences,
  listShortlist,
  addShortlist,
  updateShortlist,
  removeShortlist,
  listWatchlist,
  addWatchlist,
  removeWatchlist,
  listReports,
  createReport,
  updateReport,
  removeReport,
} = require('../controllers/scouting');

const SCOUTING_COMPARE_ROLES = new Set(['federation', 'scout', 'manager', 'club']);

function requireScoutingCompareRole(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!SCOUTING_COMPARE_ROLES.has(role)) {
    return res.status(403).json({
      msg: 'Krahasimi i lojtarëve është i disponueshëm për scout, club, manager dhe federation.',
    });
  }
  return next();
}

router.get('/meta', auth, getMeta);
router.get('/dashboard', auth, getDashboard);
router.get('/preferences', auth, getPreferences);
router.put('/preferences', auth, savePreferences);
router.get('/players', auth, getPlayers);
router.get('/players/:id', auth, getPlayer);
router.get('/recommendations', auth, getRecommendations);
router.get('/shortlist', auth, listShortlist);
router.post('/shortlist', auth, addShortlist);
router.put('/shortlist/:id', auth, updateShortlist);
router.delete('/shortlist/:id', auth, removeShortlist);
router.get('/watchlist', auth, listWatchlist);
router.post('/watchlist', auth, addWatchlist);
router.delete('/watchlist/:id', auth, removeWatchlist);
router.get('/reports', auth, listReports);
router.post('/reports', auth, createReport);
router.put('/reports/:id', auth, updateReport);
router.delete('/reports/:id', auth, removeReport);
router.get('/candidates', auth, requireScoutingCompareRole, getCompareCandidates);
router.get('/compare', auth, requireScoutingCompareRole, comparePlayers);

module.exports = router;
