const express = require('express');
const router = express.Router();
const uploadLocal = require('../middleware/uploadLocal');
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/products');

router.get('/', getProducts);
router.get('/:id', getProduct);
// Add image upload for product creation
router.post('/', uploadLocal.single('image'), createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
