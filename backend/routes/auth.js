const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

const { register, login, forgotPassword, resetPassword } = require('../controllers/auth');
const auth = require('../middleware/auth');
const User = require('../models/User');

/**
 * ============================
 * AUTH – REGISTER & LOGIN
 * ============================
 */
router.post('/register', register);
router.post('/login', login);

/**
 * ============================
 * PASSWORD RESET
 * ============================
 */
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

/**
 * ============================
 * GET CURRENT LOGGED USER
 * GET /api/auth/me
 * ============================
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        'id',
        'firstName',
        'lastName',
        'email',
        'role',
        'points',
        'level',
        'premium',
        'verified',
        'createdAt',
      ],
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('AUTH /me error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * ============================
 * GOOGLE OAUTH
 * ============================
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign(
      { user: { id: req.user.id } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${token}`
    );
  }
);

/**
 * ============================
 * FACEBOOK OAUTH
 * ============================
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign(
      { user: { id: req.user.id } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${token}`
    );
  }
);

module.exports = router;
