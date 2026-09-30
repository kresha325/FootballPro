const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireTier } = require('../utils/subscriptionAccess');
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

// Advanced analytics — Basic+ (includes 30-day trial)
router.get('/user', auth, requireTier('basic'), getUserAnalytics);
router.get('/post/:postId', auth, requireTier('basic'), getPostAnalytics);
router.get('/dashboard', auth, requireTier('basic'), getDashboardAnalytics);
router.get('/follower-growth', auth, requireTier('basic'), getFollowerGrowth);
router.get('/engagement-rate', auth, requireTier('basic'), getEngagementRate);

module.exports = router;
