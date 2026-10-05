const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/liveStreamAnalytics');

router.post('/start', auth, analyticsController.startStreamAnalytics);
router.patch('/:streamId/viewers', auth, analyticsController.updateViewers);
router.patch('/:streamId/end', auth, analyticsController.endStreamAnalytics);
router.get('/:streamId', auth, analyticsController.getAnalytics);

module.exports = router;
