const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { likePost, unlikePost } = require('../controllers/likes');

router.post('/:postId', auth, likePost);
router.delete('/:postId', auth, unlikePost);

module.exports = router;