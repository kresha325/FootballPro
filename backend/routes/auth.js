const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
require('../config/passport');
const { register, login, forgotPassword, resetPassword } = require('../controllers/auth');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { toAbsoluteUploadsUrl } = require('../utils/url');
const { issueOAuthCode, consumeOAuthCode, oauthCallbackUrl } = require('../utils/oauthExchange');

/** Plain /me JSON; URL e fotos sipas host-it të kërkesës (mobile LAN, prod, etj.). */
function meJsonWithAbsolutePhoto(plain, req) {
  if (!plain || typeof plain !== 'object') return plain;
  const out = { ...plain };
  if (out.Profile && out.Profile.profilePhoto) {
    out.Profile = {
      ...out.Profile,
      profilePhoto: toAbsoluteUploadsUrl(req, out.Profile.profilePhoto),
    };
  }
  return out;
}
const rateLimit = require('express-rate-limit');

const authRateLimitEnabled = process.env.AUTH_RATE_LIMIT_ENABLED !== 'false';

function maybeLimit(limiter) {
  return (req, res, next) => {
    if (!authRateLimitEnabled) return next();
    return limiter(req, res, next);
  };
}

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { msg: 'Shumë përpjekje. Provo përsëri më vonë.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { msg: 'Shumë përpjekje. Provo përsëri më vonë.' },
});

// Lightweight in-memory cache for /me responses to reduce DB calls and avoid 429
const meCache = new Map(); // key: userId, value: { plain, expiry } — plain pa URL absolute (ri-lidhet me req)
const ME_CACHE_TTL = 5 * 1000; // 5 seconds

const meLimiter = rateLimit({
  windowMs: 15 * 1000, // 15s window
  limit: 20, // allow bursty requests but limit repeated hits
  standardHeaders: 'draft-6',
  legacyHeaders: false,
});

// Allow toggling auth-specific rate limiter via AUTH_RATE_LIMIT_ENABLED (declared above).
const maybeMeLimiter = (req, res, next) => {
  if (!authRateLimitEnabled) return next();
  return meLimiter(req, res, next);
};

/**
 * ============================
 * VERIFY JWT TOKEN (legacy mediasoup-server; LiveKit is primary)
 * GET /api/auth/verify
 * ============================
 */
router.get('/verify', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.json({ valid: false });
  try {
    const decoded = jwt.verify(token, require('../utils/jwtSecret').getJwtSecret());
    const userId = decoded?.user?.id;
    if (!userId) return res.json({ valid: false });
    const dbUser = await User.findByPk(userId, {
      attributes: ['id', 'role', 'bannedAt', 'deletedAt', 'tokenVersion'],
    });
    if (!dbUser || dbUser.deletedAt || dbUser.bannedAt) return res.json({ valid: false });
    const tokenVersion = Number(dbUser.tokenVersion || 0);
    const claimedVersion = Number(decoded?.user?.tv || 0);
    if (tokenVersion > 0 && claimedVersion !== tokenVersion) return res.json({ valid: false });
    return res.json({ valid: true, user: { id: dbUser.id, role: dbUser.role } });
  } catch (err) {
    return res.json({ valid: false });
  }
});

/**
 * ============================
 * AUTH – REGISTER & LOGIN
 * ============================
 */
router.post('/register', maybeLimit(authWriteLimiter), register);
router.post('/login', maybeLimit(authWriteLimiter), login);
// Example route setup (replace/add as needed):
// router.post('/login', passport.authenticate('local'), authController.login);
// router.post('/register', authController.register);

/**
 * ============================
 * PASSWORD RESET
 * ============================
 */
router.post('/forgot-password', maybeLimit(passwordResetLimiter), forgotPassword);
router.post('/reset-password', maybeLimit(passwordResetLimiter), resetPassword);

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
      return res.json(meJsonWithAbsolutePhoto(cached.plain, req));
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
        'premiumExpiresAt',
        'subscriptionPlan',
        'verified',
        'createdAt',
      ],
      include: [{ model: Profile, attributes: ['profilePhoto', 'youtubeChannelId'], required: false }],
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const { persistReconcileIfNeeded, buildAccessPayload } = require('../utils/subscriptionAccess');
    await persistReconcileIfNeeded(user);

    const plain = user.get({ plain: true });
    const access = buildAccessPayload(plain);
    plain.premium = access.premium;
    plain.effectiveTier = access.effectiveTier;
    plain.trialEndsAt = access.trialEndsAt;
    plain.inTrial = access.inTrial;
    plain.access = access;

    meCache.set(req.user.id, { plain, expiry: now + ME_CACHE_TTL });

    res.json(meJsonWithAbsolutePhoto(plain, req));
  } catch (err) {
    console.error('AUTH /me error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * ============================
 * OAUTH PROVIDERS STATUS
 * ============================
 */
router.get('/providers', (_req, res) => {
  const { appleConfigured } = require('../config/passport');
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    apple: typeof appleConfigured === 'function' ? appleConfigured() : false,
  });
});

function oauthState(req) {
  return String(req.query?.state || req.body?.state || '');
}

function oauthFailureRedirect(req, reason) {
  const isMobile = oauthState(req) === 'mobile';
  const detail = reason ? `&reason=${encodeURIComponent(String(reason).slice(0, 180))}` : '';
  if (isMobile) {
    return `xtalenti://auth/callback?error=oauth_failed${detail}`;
  }
  const front = (process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, '');
  return `${front}/login?error=oauth_failed${detail}`;
}

function issueOAuthJwtRedirect(req, res) {
  const token = jwt.sign(
    { user: { id: req.user.id, tv: Number(req.user.tokenVersion || 0) } },
    require('../utils/jwtSecret').getJwtSecret(),
    { expiresIn: '7d' }
  );
  const code = issueOAuthCode(token);
  const front = (process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, '');
  res.redirect(oauthCallbackUrl({
    mobile: oauthState(req) === 'mobile',
    frontendUrl: front,
    code,
  }));
}

router.post('/oauth/exchange', maybeLimit(authWriteLimiter), (req, res) => {
  const token = consumeOAuthCode(req.body?.code);
  if (!token) {
    return res.status(400).json({ msg: 'Kodi i hyrjes është i pavlefshëm ose i skaduar' });
  }
  return res.json({ token });
});

function authenticateOAuth(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, { session: false }, (err, user, info) => {
      if (err) {
        console.error(`[oauth:${provider}] error:`, err?.message || err);
        return res.redirect(oauthFailureRedirect(req, err.message || 'auth_error'));
      }
      if (!user) {
        const msg = info?.message || info?.toString?.() || 'no_user';
        console.error(`[oauth:${provider}] failed:`, msg);
        return res.redirect(oauthFailureRedirect(req, msg));
      }
      req.user = user;
      return next();
    })(req, res, next);
  };
}

/**
 * ============================
 * GOOGLE OAUTH
 * ============================
 */
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ msg: 'Google OAuth nuk është konfiguruar' });
  }
  const isMobile = req.query.app === '1' || req.query.mobile === '1';
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: isMobile ? 'mobile' : 'web',
  })(req, res, next);
});

router.get(
  '/google/callback',
  authenticateOAuth('google'),
  issueOAuthJwtRedirect
);

/**
 * ============================
 * FACEBOOK OAUTH
 * ============================
 */
router.get('/facebook', (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return res.status(503).json({ msg: 'Facebook OAuth nuk është konfiguruar' });
  }
  const isMobile = req.query.app === '1' || req.query.mobile === '1';
  const { facebookCallbackURL } = require('../config/passport');
  console.log('[oauth:facebook] start', {
    callbackURL: typeof facebookCallbackURL === 'function' ? facebookCallbackURL() : null,
    mobile: isMobile,
  });
  // Request email only after it is added under Meta Use cases → Permissions (+ Add).
  // Invalid Scopes: email happens when the permission is not yet on the app.
  const facebookScopes = ['public_profile'];
  if (String(process.env.FACEBOOK_REQUEST_EMAIL || '').trim() === '1') {
    facebookScopes.push('email');
  }
  passport.authenticate('facebook', {
    scope: facebookScopes,
    state: isMobile ? 'mobile' : 'web',
  })(req, res, next);
});

router.get(
  '/facebook/callback',
  authenticateOAuth('facebook'),
  issueOAuthJwtRedirect
);

/**
 * ============================
 * APPLE SIGN IN
 * ============================
 * Apple returns via HTTPS POST (form_post). Register Return URL:
 *   https://YOUR-BACKEND/api/auth/apple/callback
 */
router.get('/apple', (req, res, next) => {
  const { appleConfigured } = require('../config/passport');
  if (!appleConfigured()) {
    return res.status(503).json({ msg: 'Apple Sign In nuk është konfiguruar' });
  }
  const isMobile = req.query.app === '1' || req.query.mobile === '1';
  passport.authenticate('apple', {
    state: isMobile ? 'mobile' : 'web',
  })(req, res, next);
});

router.post(
  '/apple/callback',
  (req, res, next) => {
    passport.authenticate('apple', {
      failureRedirect: oauthFailureRedirect(req),
      session: false,
    })(req, res, next);
  },
  issueOAuthJwtRedirect
);

// Some Apple flows / proxies may GET; keep a soft fallback
router.get('/apple/callback', (req, res) => {
  res.redirect(oauthFailureRedirect(req));
});

module.exports = router;
module.exports.authWriteLimiter = authWriteLimiter;
