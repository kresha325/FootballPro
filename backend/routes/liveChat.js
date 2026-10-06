const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveChatController = require('../controllers/liveChat');

router.post('/send', auth, liveChatController.sendMessage);
router.get('/:streamId', liveChatController.getMessages);

module.exports = router;
