const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamification');
const auth = require('../middleware/auth');

// Get user gamification data (own profile)
router.get('/user', auth, gamificationController.getUserGamification);

// Get user gamification data (specific user)
router.get('/user/:userId', auth, gamificationController.getUserGamification);

// Get leaderboard
router.get('/leaderboard', auth, gamificationController.getLeaderboard);

// Get achievements with progress
router.get('/achievements', auth, gamificationController.getAchievements);

// Get badges with status
router.get('/badges', auth, gamificationController.getBadges);

// Claim reward
router.post('/rewards/:rewardId/claim', auth, gamificationController.claimReward);

module.exports = router;