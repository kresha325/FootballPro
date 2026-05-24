const express = require('express');
const router = express.Router();
const { paymentsLiveEnabled, stripeLiveReady } = require('../config/payments');

router.get('/public', (_req, res) => {
  res.json({
    paymentsEnabled: paymentsLiveEnabled(),
    stripeConfigured: stripeLiveReady(),
    marketplacePayments: 'joncoin',
    premiumMode: stripeLiveReady() ? 'stripe' : 'demo',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

module.exports = router;
