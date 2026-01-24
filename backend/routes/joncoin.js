const express = require('express');
const router = express.Router();
const joncoinController = require('../controllers/joncoin');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Get current user's JonCoin balance
router.get('/balance', auth, joncoinController.getBalance);

// Admin: add coins to a user
router.post('/add', auth, admin, joncoinController.addCoins);

// Transfer coins to another user
router.post('/transfer', auth, joncoinController.transferCoins);

module.exports = router;
