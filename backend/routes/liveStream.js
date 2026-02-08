const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveStreamController = require('../controllers/liveStream');

// Start a live stream
router.post('/start', auth, liveStreamController.startLiveStream);
// End a live stream
router.post('/:streamId/end', auth, liveStreamController.endLiveStream);
// Get all active live streams
router.get('/active', liveStreamController.getActiveLiveStreams);
// Get stream details
router.get('/:streamId', liveStreamController.getLiveStreamDetails);
// Update viewers count
router.put('/:streamId/viewers', liveStreamController.updateViewersCount);
// Save live video after stream ends
router.post('/:streamId/save-video', auth, liveStreamController.saveLiveVideo);

module.exports = router;
