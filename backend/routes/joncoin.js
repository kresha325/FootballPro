const express = require('express');
const router = express.Router();

const joncoin = require('../controllers/joncoin');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Të gjitha ruterat kërkojnë autentikim
router.use(auth);

router.get('/balance', joncoin.getBalance);
router.get('/transactions', joncoin.getTransactions);
router.post('/purchase', joncoin.purchase);
router.post('/spend', joncoin.spend);
router.post('/reward', admin, joncoin.reward); // admin only — never mint for any authed user
router.post('/withdraw', joncoin.withdraw);
router.patch('/transaction/:id', admin, joncoin.updateTransactionStatus); // admin
router.post('/transfer', joncoin.transfer); // user-to-user transfer

module.exports = router;
