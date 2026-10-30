const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const verificationController = require('../controllers/verification');
const { rateLimit } = require('express-rate-limit');

const requestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Provo përsëri më vonë.' } });
const tokenLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: 'Shumë kërkesa. Provo përsëri më vonë.' });

router.post('/parent-request', requestLimiter, auth, verificationController.parentRequest);
router.post('/communication-request', requestLimiter, auth, verificationController.requestCommunicationConsent);
// GET shows a button page (safe for WhatsApp preview); POST completes confirmation
router.get('/parent-confirm', tokenLimiter, verificationController.parentConfirmPage);
router.post('/parent-confirm', tokenLimiter, verificationController.parentConfirm);
router.get('/parent-revoke', tokenLimiter, verificationController.parentRevokePage);
router.post('/parent-revoke', tokenLimiter, verificationController.parentRevoke);

module.exports = router;
