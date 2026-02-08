const express = require('express');
const router = express.Router();
const scheduledController = require('../controllers/scheduledLiveStream');

router.post('/schedule', scheduledController.scheduleStream);
router.get('/list', scheduledController.getScheduledStreams);
router.patch('/:streamId/status', scheduledController.updateStreamStatus);

module.exports = router;
