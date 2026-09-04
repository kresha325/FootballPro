const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
require('../config/passport');
const { register, login, forgotPassword, resetPassword } = require('../controllers/auth');
const auth = require('../middleware/auth');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

// Lightweight in-memory cache for /me responses to reduce DB calls and avoid 429
const meCache = new Map(); // key: userId, value: { user, expiry }
const ME_CACHE_TTL = 5 * 1000; // 5 seconds

const meLimiter = rateLimit({
  windowMs: 15 * 1000, // 15s window
  max: 20, // allow bursty requests but limit repeated hits
  standardHeaders: true,
  legacyHeaders: false,
});

// Allow toggling auth-specific rate limiter via env var
const authRateLimitEnabled = process.env.AUTH_RATE_LIMIT_ENABLED !== 'false';

// middleware wrapper that conditionally applies the limiter
const maybeMeLimiter = (req, res, next) => {
  if (!authRateLimitEnabled) return next();
  return meLimiter(req, res, next);
};

/**
 * ============================
 * VERIFY JWT TOKEN (for mediasoup-server)
 * GET /api/auth/verify
 * ============================
 */
router.get('/verify', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.json({ valid: false });
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ valid: false, msg: 'Authentication is not configured' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded.user });
  } catch (err) {
    res.json({ valid: false });
  }
});

/**
 * ============================
 * AUTH – REGISTER & LOGIN
 * ============================
 */
router.post('/register', register);
router.post('/login', login);
// Example route setup (replace/add as needed):
// router.post('/login', passport.authenticate('local'), authController.login);
// router.post('/register', authController.register);

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
router.get('/me', maybeMeLimiter, auth, async (req, res) => {
  try {
    const cached = meCache.get(req.user.id);
    const now = Date.now();
    if (cached && cached.expiry > now) {
      return res.json(cached.user);
    }

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

    // cache for short time
    meCache.set(req.user.id, { user, expiry: now + ME_CACHE_TTL });

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
