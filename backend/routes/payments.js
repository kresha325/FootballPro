const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getPayments, createPayment } = require('../controllers/payments');
const { 
  createCheckoutSession, 
  stripeWebhook, 
  verifySession 
} = require('../controllers/stripePayments');

// Stripe webhook (NO auth middleware - Stripe needs raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Protected routes
router.get('/', auth, getPayments);
router.post('/', auth, createPayment);
router.post('/create-checkout-session', auth, createCheckoutSession);
router.get('/verify-session/:sessionId', auth, verifySession);

module.exports = router;