const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const youtubeCtrl = require('../controllers/youtube');

router.get('/resolve', auth, youtubeCtrl.resolveChannel);
router.post('/resolve', auth, youtubeCtrl.resolveChannel);

module.exports = router;
