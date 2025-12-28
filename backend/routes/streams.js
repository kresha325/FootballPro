const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streams');
const auth = require('../middleware/auth');

router.post('/', auth, streamController.createStream);
router.get('/', auth, streamController.getStreams);
router.get('/:id', auth, streamController.getStream);
router.put('/:id/start', auth, streamController.startStream);
router.put('/:id/end', auth, streamController.endStream);
router.post('/:id/join', auth, streamController.joinStream);
router.post('/:id/leave', auth, streamController.leaveStream);

module.exports = router;