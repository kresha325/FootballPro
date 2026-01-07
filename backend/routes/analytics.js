const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  trackProfileView,
  trackPostInteraction,
  getUserAnalytics,
  getPostAnalytics,
  getDashboardAnalytics,
  getFollowerGrowth,
  getEngagementRate,
  getClubAnalytics
} = require('../controllers/analytics');

// Club analytics summary
router.get('/club/:clubId', getClubAnalytics);

// Track interactions
router.post('/profile/:profileId/view', auth, trackProfileView);
router.post('/post/:postId/:type', auth, trackPostInteraction);

// Get analytics
router.get('/user', auth, getUserAnalytics);
router.get('/post/:postId', auth, getPostAnalytics);
router.get('/dashboard', auth, getDashboardAnalytics);
router.get('/follower-growth', auth, getFollowerGrowth);
router.get('/engagement-rate', auth, getEngagementRate);

module.exports = router;