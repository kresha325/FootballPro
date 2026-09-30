const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  createMedia,
  listMedia,
  getMedia,
  updateMedia,
  deleteMedia,
  trackMediaEvent,
  adminListMedia,
} = require('../controllers/mediaItems');

const optionalAuth = auth.optionalAuth || ((req, res, next) => next());

router.get('/admin', auth, admin, adminListMedia);
router.get('/', optionalAuth, listMedia);
router.post('/', auth, createMedia);
router.get('/:id', optionalAuth, getMedia);
router.put('/:id', auth, updateMedia);
router.delete('/:id', auth, deleteMedia);
router.post('/:id/events', optionalAuth, trackMediaEvent);

module.exports = router;
