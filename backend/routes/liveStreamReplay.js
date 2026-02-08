const express = require('express');
const router = express.Router();
const replayController = require('../controllers/liveStreamReplay');

router.post('/save', replayController.saveReplay);
router.get('/:streamId', replayController.getReplays);
router.get('/:streamId/highlights', replayController.getHighlights);

module.exports = router;
