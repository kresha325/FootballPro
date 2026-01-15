const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getPosts, getPost, createPost, getUserPosts, deletePost } = require('../controllers/posts');
const uploadCloud = require('../middleware/uploadCloudinary');


const { setPostSponsors } = require('../controllers/posts');

router.get('/', auth, getPosts);
router.get('/user/:userId', auth, getUserPosts);
router.get('/user/me', auth, getUserPosts);
router.get('/:id', auth, getPost);
router.post('/', auth, uploadCloud.single('image'), createPost);
router.post('/:postId/sponsors', auth, setPostSponsors);
router.delete('/:id', auth, deletePost);

module.exports = router;