const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getPayments, createPayment } = require('../controllers/payments');
const { 
  createCheckoutSession, 
  verifySession 
} = require('../controllers/stripePayments');

// Stripe webhook is mounted in server.js before express.json()

// Protected routes
router.get('/', auth, getPayments);
router.post('/', auth, createPayment);
router.post('/create-checkout-session', auth, createCheckoutSession);
router.get('/verify-session/:sessionId', auth, verifySession);

module.exports = router;