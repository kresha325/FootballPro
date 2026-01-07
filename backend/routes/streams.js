const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streams');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const uploadDir = path.join(__dirname, '../uploads/streams');
if (!require('fs').existsSync(uploadDir)) require('fs').mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `stream-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });
// Endpoint për të fshirë stream-in (dhe videon e lidhur)
router.delete('/:id', auth, streamController.deleteStream);
// Endpoint për të ngarkuar video të regjistruar nga frontend
router.post('/upload-recording', auth, upload.single('video'), streamController.uploadRecording);


// Endpoint për të nisur ose përditësuar stream WebRTC si live
router.post('/go-live-webrtc', auth, streamController.goLiveWebRTC);
// Endpoint për të marrë stream key dhe RTMP/HLS URL për përdoruesin aktual
router.get('/me/stream-info', auth, streamController.getMyStreamInfo);

router.post('/', auth, streamController.createStream);
router.get('/', auth, streamController.getStreams);
router.get('/:id', auth, streamController.getStream);
router.put('/:id/start', auth, streamController.startStream);
router.put('/:id/end', auth, streamController.endStream);
router.post('/:id/join', auth, streamController.joinStream);
router.post('/:id/leave', auth, streamController.leaveStream);

module.exports = router;