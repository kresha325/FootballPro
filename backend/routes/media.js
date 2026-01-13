const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, mediaController.createMedia);
router.get('/:id?', authenticate, mediaController.getMedia);
router.put('/', authenticate, mediaController.updateMedia);
router.get('/', authenticate, mediaController.getAllMedias);

module.exports = router;
