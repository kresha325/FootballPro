const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const videosController = require('../controllers/videos');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
}

function uploadVideoFile(req, res, next) {
  videosController.upload.single('video')(req, res, (err) => {
    if (!err) return next();
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message || 'Invalid video' });
  });
}

router.post(
  '/upload',
  auth,
  uploadVideoFile,
  body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().trim().isLength({ max: 5000 }),
  validate,
  videosController.uploadVideo
);

router.get('/', optionalAuth, videosController.getVideos);
router.get('/trending', optionalAuth, videosController.getTrendingVideos);
router.get('/user/:userId', optionalAuth, videosController.getUserVideos);
router.get('/:id', optionalAuth, videosController.getVideo);

router.put(
  '/:id',
  auth,
  param('id').isInt({ min: 1 }),
  body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().trim().isLength({ max: 5000 }),
  validate,
  videosController.updateVideo
);

router.delete(
  '/:id',
  auth,
  param('id').isInt({ min: 1 }),
  validate,
  videosController.deleteVideo
);

router.post(
  '/:id/like',
  auth,
  param('id').isInt({ min: 1 }),
  validate,
  videosController.likeVideo
);

module.exports = router;
