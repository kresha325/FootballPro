const express = require('express');
const router = express.Router();
const liveChatController = require('../controllers/liveChat');

router.post('/send', liveChatController.sendMessage);
router.get('/:streamId', liveChatController.getMessages);

module.exports = router;
