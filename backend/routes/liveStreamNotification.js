const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/liveStreamNotification');

router.post('/send', auth, notificationController.sendLiveNotification);

module.exports = router;
