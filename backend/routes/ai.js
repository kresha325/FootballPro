const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiCtrl = require('../controllers/ai');

router.get('/status', aiCtrl.status);
router.post('/generate-bio', auth, aiCtrl.generateBio);
router.post('/scout-summary/:userId', auth, aiCtrl.scoutSummary);
router.post('/suggest-post', auth, aiCtrl.suggestPost);

module.exports = router;
