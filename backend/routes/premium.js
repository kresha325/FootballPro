const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createPremiumCheckout, verifyPremiumSession } = require('../controllers/premium');

router.post('/checkout', auth, createPremiumCheckout);
router.get('/verify-session/:sessionId', auth, verifyPremiumSession);

module.exports = router;
