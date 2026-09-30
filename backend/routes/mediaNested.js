const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const {
  listPlayerMedia,
  listClubMedia,
  listMatchMedia,
} = require('../controllers/mediaItems');

const optionalAuth = auth.optionalAuth || ((req, res, next) => next());

router.get('/players/:playerId/media', optionalAuth, listPlayerMedia);
router.get('/clubs/:clubId/media', optionalAuth, listClubMedia);
router.get('/matches/:matchId/media', optionalAuth, listMatchMedia);

module.exports = router;
