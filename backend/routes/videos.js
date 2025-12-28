const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const videosController = require('../controllers/videos');

// @route   POST /api/videos/upload
// @desc    Upload a video
// @access  Private
router.post('/upload', auth, videosController.upload.single('video'), videosController.uploadVideo);

// @route   GET /api/videos
// @desc    Get all videos
// @access  Private
router.get('/', auth, videosController.getVideos);

// @route   GET /api/videos/trending
// @desc    Get trending videos
// @access  Private
router.get('/trending', auth, videosController.getTrendingVideos);

// @route   GET /api/videos/user/:userId
// @desc    Get user's videos
// @access  Private
router.get('/user/:userId', auth, videosController.getUserVideos);

// @route   GET /api/videos/:id
// @desc    Get single video
// @access  Private
router.get('/:id', auth, videosController.getVideo);

// @route   PUT /api/videos/:id
// @desc    Update video
// @access  Private
router.put('/:id', auth, videosController.updateVideo);

// @route   DELETE /api/videos/:id
// @desc    Delete video
// @access  Private
router.delete('/:id', auth, videosController.deleteVideo);

// @route   POST /api/videos/:id/like
// @desc    Like a video
// @access  Private
router.post('/:id/like', auth, videosController.likeVideo);

module.exports = router;
