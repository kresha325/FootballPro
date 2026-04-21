const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/products');
const uploadLocal = require('../middleware/uploadLocal');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', uploadLocal.single('image'), createProduct);
router.put('/:id', auth, uploadLocal.single('image'), updateProduct);
router.delete('/:id', auth, deleteProduct);

module.exports = router;