const express = require('express');
const router = express.Router();
const liveChatController = require('../controllers/liveChat');
const auth = require('../middleware/auth');

router.post('/send', auth, liveChatController.sendMessage);
router.get('/:streamId', liveChatController.getMessages);

module.exports = router;
