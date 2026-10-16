const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const { createToken } = require('../controllers/livekit');

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { msg: 'Shumë kërkesa për token LiveKit. Provo përsëri më vonë.' },
});

router.post('/token', tokenLimiter, optionalAuth, createToken);

module.exports = router;
