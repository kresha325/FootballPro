

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const gamificationController = require('../controllers/gamification.js');


router.get('/user', auth, async (req, res) => {
  console.log('ROUTE req.user:', req.user);
  console.log('ROUTE req.headers:', req.headers);
  await gamificationController.getUserGamification(req, res);
});

router.get('/achievements', auth, gamificationController.getAchievements);
router.get('/badges', auth, gamificationController.getBadges);
router.get('/leaderboard', auth, gamificationController.getLeaderboard);

module.exports = router;
