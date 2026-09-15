const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const verificationController = require('../controllers/verification');

router.post('/parent-request', auth, verificationController.parentRequest);
// GET shows a button page (safe for WhatsApp preview); POST completes confirmation
router.get('/parent-confirm', verificationController.parentConfirmPage);
router.post('/parent-confirm', verificationController.parentConfirm);

module.exports = router;
