const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadLocal = require('../middleware/uploadLocal');
const streamsCtrl = require('../controllers/streams');

router.get('/', streamsCtrl.getStreams);
router.get('/:id', streamsCtrl.getStream);
router.post('/', auth, streamsCtrl.createStream);
router.put('/:id/start', auth, streamsCtrl.startStream);
router.put('/:id/end', auth, streamsCtrl.endStream);
router.post('/:id/join', auth, streamsCtrl.joinStream);
router.post('/:id/leave', auth, streamsCtrl.leaveStream);

// Temp upload: store recording file and return URL
router.post('/upload-temp', auth, uploadLocal.single('video'), streamsCtrl.uploadTemp);
router.delete('/temp/:filename', auth, streamsCtrl.deleteTemp);

module.exports = router;
// Stream/livestream routes removed