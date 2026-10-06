const express = require('express');
const router = express.Router();
const uploadLocal = require('../middleware/uploadLocal');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/products');

router.get('/', getProducts);
router.get('/:id', optionalAuth, getProduct);
router.post('/', auth, uploadLocal.single('image'), createProduct);
router.put('/:id', auth, updateProduct);
router.delete('/:id', auth, deleteProduct);

module.exports = router;
