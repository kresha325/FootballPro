const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createToken } = require('../controllers/livekit');

router.post('/token', auth, createToken);

module.exports = router;
