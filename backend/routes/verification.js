const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const verificationController = require('../controllers/verification');

router.post('/parent-request', auth, verificationController.parentRequest);
router.get('/parent-confirm', verificationController.parentConfirm);

module.exports = router;
