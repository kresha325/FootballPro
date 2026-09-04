const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/products');
const uploadLocal = require('../middleware/uploadLocal');
const auth = require('../middleware/auth');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', auth, uploadLocal.single('image'), createProduct);
router.put('/:id', auth, updateProduct);
router.delete('/:id', auth, deleteProduct);

module.exports = router;