const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getGallery, getUserGallery, createGalleryItem, upload } = require('../controllers/gallery');

router.get('/', auth, getGallery);
router.get('/user/:userId', auth, getUserGallery);
router.post('/', auth, upload.single('image'), createGalleryItem);

module.exports = router;