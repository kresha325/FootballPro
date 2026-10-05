const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const scheduledController = require('../controllers/scheduledLiveStream');

router.post('/schedule', auth, scheduledController.scheduleStream);
router.get('/list', auth, scheduledController.getScheduledStreams);
router.patch('/:streamId/status', auth, scheduledController.updateStreamStatus);

module.exports = router;
