const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const replayController = require('../controllers/liveStreamReplay');

router.post('/save', auth, replayController.saveReplay);
router.get('/:streamId', replayController.getReplays);
router.get('/:streamId/highlights', replayController.getHighlights);

module.exports = router;
