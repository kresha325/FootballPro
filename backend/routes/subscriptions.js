const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { subscribe, unsubscribe, getSubscriptions } = require('../controllers/subscriptions');

router.get('/', auth, getSubscriptions);
router.post('/:userId', auth, subscribe);
router.delete('/:userId', auth, unsubscribe);

module.exports = router;