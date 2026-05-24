const express = require('express');
const router = express.Router();
const { paymentsLiveEnabled, stripeLiveReady } = require('../config/payments');
const { isEmailConfigured } = require('../config/email');
const { isAiConfigured } = require('../config/ai');

function livekitConfigured() {
  return !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
}

router.get('/public', (_req, res) => {
  res.json({
    paymentsEnabled: paymentsLiveEnabled(),
    stripeConfigured: stripeLiveReady(),
    livekitConfigured: livekitConfigured(),
    emailConfigured: isEmailConfigured(),
    aiConfigured: isAiConfigured(),
    marketplacePayments: 'joncoin',
    premiumMode: stripeLiveReady() ? 'stripe' : 'demo',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

module.exports = router;
