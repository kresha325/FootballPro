const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cart = require('../controllers/cart');

router.use(auth);
router.get('/', cart.getCart);
router.post('/quote', cart.quote);
router.post('/items', cart.addItem);
router.patch('/items/:productId', cart.updateItem);
router.delete('/items/:productId', cart.removeItem);
router.delete('/', cart.clearCart);

module.exports = router;
