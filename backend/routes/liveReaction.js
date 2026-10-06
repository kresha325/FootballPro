const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveReactionController = require('../controllers/liveReaction');

router.post('/send', auth, liveReactionController.sendReaction);
router.get('/:streamId', liveReactionController.getReactions);

module.exports = router;
