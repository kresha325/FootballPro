const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getOrders, getOrder, createOrder, updateOrderStatus, confirmOrder } = require('../controllers/orders');

router.get('/', auth, getOrders);
router.get('/:id', auth, getOrder);
router.post('/', auth, createOrder);
router.post('/confirm', auth, confirmOrder);
router.put('/:id/status', auth, updateOrderStatus);

module.exports = router;