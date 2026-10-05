const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getOrders,
  getSellerOrders,
  getSellerSummary,
  getOrder,
  createOrder,
  updateOrderStatus,
  confirmOrder,
  acceptOrder,
  rejectOrder,
  refundOrder,
} = require('../controllers/orders');

router.get('/', auth, getOrders);
router.get('/selling/summary', auth, getSellerSummary);
router.get('/selling', auth, getSellerOrders);
router.get('/:id', auth, getOrder);
router.post('/', auth, createOrder);
router.post('/confirm', auth, confirmOrder);
router.post('/:id/accept', auth, acceptOrder);
router.post('/:id/reject', auth, rejectOrder);
router.post('/:id/refund', auth, refundOrder);
router.put('/:id/status', auth, updateOrderStatus);

module.exports = router;
