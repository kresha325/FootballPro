const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const uploadLocal = require('../middleware/uploadLocal');
const streamsCtrl = require('../controllers/streams');

router.get('/', optionalAuth, streamsCtrl.getStreams);
router.get('/discovery', optionalAuth, streamsCtrl.getDiscovery);
router.get('/my/stream-info', auth, streamsCtrl.getMyStreamInfo);
router.get('/:id', optionalAuth, streamsCtrl.getStream);
router.post('/', auth, streamsCtrl.createStream);
router.put('/:id/start', auth, streamsCtrl.startStream);
router.put('/:id/heartbeat', auth, streamsCtrl.heartbeatStream);
router.put('/:id/end', auth, streamsCtrl.endStream);
router.put('/:id/cancel', auth, streamsCtrl.cancelStream);
router.put('/:id/fail', auth, streamsCtrl.failStream);
router.post('/:id/save-replay', auth, streamsCtrl.saveLiveReplay);
router.put('/:id/viewers', streamsCtrl.updateViewersInternal);
router.put('/:id/end-internal', streamsCtrl.endStreamInternal);
router.post('/:id/join', auth, streamsCtrl.joinStream);
router.post('/:id/leave', auth, streamsCtrl.leaveStream);

// Temp upload: store recording file and return URL
router.post('/upload-temp', auth, uploadLocal.single('video'), streamsCtrl.uploadTemp);
router.delete('/temp/:filename', auth, streamsCtrl.deleteTemp);
router.post('/finalize', auth, streamsCtrl.finalizeTemp);
router.post('/upload-recording', auth, uploadLocal.single('video'), streamsCtrl.uploadRecording);

module.exports = router;
// Stream/livestream routes removed