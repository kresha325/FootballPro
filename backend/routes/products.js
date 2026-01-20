const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/products');
const uploadLocal = require('../middleware/uploadLocal');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', uploadLocal.single('image'), createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;