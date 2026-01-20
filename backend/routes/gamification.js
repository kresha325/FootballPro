

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
router.get('/leaderboard', auth, async (req, res) => {
  // Simple leaderboard: top 50 users by points/level
  const { User, UserBadge, Badge, Profile } = require('../models');
  try {
    const users = await User.findAll({
      order: [['points', 'DESC'], ['level', 'DESC']],
      limit: 50,
      include: [
        { model: UserBadge, include: [Badge] },
        { model: Profile }
      ]
    });
    const leaderboard = users.map((u, idx) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      level: u.level,
      points: u.points,
      rank: idx + 1,
      Profile: u.Profile,
      UserBadges: u.UserBadges,
      isCurrentUser: req.user && req.user.id === u.id
    }));
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: 'Leaderboard error' });
  }
});

module.exports = router;
