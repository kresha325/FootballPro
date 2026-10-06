const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const moderationController = require('../controllers/liveChatModeration');

router.delete('/message/:messageId', auth, moderationController.deleteMessage);
router.post('/block-user', auth, moderationController.blockUser);

module.exports = router;
