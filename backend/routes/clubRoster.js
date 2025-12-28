const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  submitRosterRequest,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getClubRoster,
  removeFromRoster,
} = require('../controllers/clubRoster');

// Submit roster request (athlete)
router.post('/request', auth, submitRosterRequest);

// Get pending requests (club only)
router.get('/pending', auth, getPendingRequests);

// Get all requests (filtered by user role)
router.get('/requests', auth, getAllRequests);

// Approve request (club only)
router.put('/requests/:requestId/approve', auth, approveRequest);

// Reject request (club only)
router.put('/requests/:requestId/reject', auth, rejectRequest);

// Get club's approved roster (public)
router.get('/club/:clubId', auth, getClubRoster);

// Remove player from roster (club only)
router.delete('/requests/:requestId', auth, removeFromRoster);

module.exports = router;
