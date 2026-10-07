const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const joncoin = require('../controllers/joncoin');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const { requirePermission } = require('../middleware/admin');

// Shared per user, not per IP. Purchase and withdraw draw from the same window.
const joncoinWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: (req) => `joncoin:${req.user?.id || 'anonymous'}`,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Shumë përpjekje. Provo përsëri më vonë.' });
  },
});

// Të gjitha ruterat kërkojnë autentikim
router.use(auth);

router.get('/balance', joncoin.getBalance);
router.get('/transactions', joncoin.getTransactions);
router.post('/purchase', joncoinWriteLimiter, joncoin.purchase);
router.post('/deposit-checkout', joncoin.createDepositCheckout);
router.post('/spend', joncoin.spend);
router.post('/reward', admin, requirePermission('finance.adjust'), joncoin.reward); // admin only — never mint for any authed user
router.post('/withdraw', joncoinWriteLimiter, joncoin.withdraw);
router.patch('/transaction/:id', admin, requirePermission('finance.adjust'), joncoin.updateTransactionStatus); // admin
router.post('/transfer', joncoin.transfer); // user-to-user transfer

module.exports = router;
