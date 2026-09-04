const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/liveChatModeration');
const auth = require('../middleware/auth');

router.delete('/message/:messageId', auth, moderationController.deleteMessage);
router.post('/block-user', auth, moderationController.blockUser);

module.exports = router;
