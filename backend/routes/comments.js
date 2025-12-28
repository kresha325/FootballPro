const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getComments, createComment, deleteComment } = require('../controllers/comments');

router.get('/:postId', auth, getComments);
router.post('/:postId', auth, createComment);
router.delete('/:commentId', auth, deleteComment);

module.exports = router;