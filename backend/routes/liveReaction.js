const express = require('express');
const router = express.Router();
const liveReactionController = require('../controllers/liveReaction');

router.post('/send', liveReactionController.sendReaction);
router.get('/:streamId', liveReactionController.getReactions);

module.exports = router;
