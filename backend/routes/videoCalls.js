const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  startCall,
  endCall,
  scheduleCall,
  getScheduledCalls,
  getActiveCall,
  updateCallStatus,
  getCallHistory,
  createVideoCall,
} = require('../controllers/videoCalls');

router.post('/start', authenticate, startCall);
router.post('/create', authenticate, createVideoCall);
router.put('/:callId/end', authenticate, endCall);
router.put('/:callId/status', authenticate, updateCallStatus);
router.get('/active', authenticate, getActiveCall);
router.get('/history', authenticate, getCallHistory);
router.post('/schedule', authenticate, scheduleCall);
router.get('/scheduled', authenticate, getScheduledCalls);

module.exports = router;