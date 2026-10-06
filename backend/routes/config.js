const express = require('express');
const router = express.Router();
const { paymentsLiveEnabled, stripeLiveReady } = require('../config/payments');
const { isEmailConfigured } = require('../config/email');
const { isAiConfigured } = require('../config/ai');
const { isSupportChatConfiguredSync } = require('../utils/supportTeam');

function livekitConfigured() {
  return !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
}

router.get('/public', async (_req, res) => {
  res.json({
    paymentsEnabled: paymentsLiveEnabled(),
    stripeConfigured: stripeLiveReady(),
    livekitConfigured: livekitConfigured(),
    emailConfigured: isEmailConfigured(),
    aiConfigured: isAiConfigured(),
    supportChatConfigured: isSupportChatConfiguredSync(),
    marketplacePayments: 'joncoin',
    premiumMode: stripeLiveReady() ? 'stripe' : 'demo',
    version: process.env.APP_VERSION || '1.0.2-cv',
    ...(await require('../services/admin/settings').publicConfig()),
  });
});

module.exports = router;
