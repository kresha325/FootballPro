const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const replayController = require('../controllers/liveStreamReplay');

router.post('/save', auth, replayController.saveReplay);
router.get('/:streamId', optionalAuth, replayController.getReplays);
router.get('/:streamId/highlights', optionalAuth, replayController.getHighlights);

module.exports = router;
