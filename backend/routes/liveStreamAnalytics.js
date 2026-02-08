const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/liveStreamAnalytics');

router.post('/start', analyticsController.startStreamAnalytics);
router.patch('/:streamId/viewers', analyticsController.updateViewers);
router.patch('/:streamId/end', analyticsController.endStreamAnalytics);
router.get('/:streamId', analyticsController.getAnalytics);

module.exports = router;
