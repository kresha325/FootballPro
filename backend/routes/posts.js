const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getPosts, getPost, createPost, getUserPosts, deletePost } = require('../controllers/posts');
const uploadCloud = require('../middleware/uploadCloudinary');

router.get('/', auth, getPosts);
router.get('/user/:userId', auth, getUserPosts);
router.get('/user/me', auth, getUserPosts);
router.get('/:id', auth, getPost);
router.post('/', auth, uploadCloud.single('image'), createPost);
router.delete('/:id', auth, deletePost);

module.exports = router;