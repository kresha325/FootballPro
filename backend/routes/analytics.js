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
const hub = require('../controllers/analyticsHub');

router.get('/home', auth, hub.home);
router.get('/definitions', auth, hub.definitions);
router.get('/player/:userId', auth, hub.player);
router.get('/scouting/player/:userId', auth, hub.scoutingPlayer);
router.get('/scouting', auth, hub.scouting);
router.get('/marketplace', auth, hub.marketplace);
router.get('/wallet', auth, hub.wallet);
router.get('/video', auth, hub.video);
router.get('/competition/:id', auth, hub.competition);
router.get('/compare', auth, hub.compare);
router.get('/social', auth, requireTier('basic'), hub.socialSummary);

router.get('/club/:clubId', auth, getClubAnalytics);

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
