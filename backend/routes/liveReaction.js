const express = require('express');
const router = express.Router();
const liveReactionController = require('../controllers/liveReaction');
const auth = require('../middleware/auth');

router.post('/send', auth, liveReactionController.sendReaction);
router.get('/:streamId', liveReactionController.getReactions);

module.exports = router;
