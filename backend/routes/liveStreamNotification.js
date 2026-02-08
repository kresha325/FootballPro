const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/liveStreamNotification');

router.post('/send', notificationController.sendLiveNotification);

module.exports = router;
