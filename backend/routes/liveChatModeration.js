const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/liveChatModeration');

router.delete('/message/:messageId', moderationController.deleteMessage);
router.post('/block-user', moderationController.blockUser);

module.exports = router;
