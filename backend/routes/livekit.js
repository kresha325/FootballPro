const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { createToken } = require('../controllers/livekit');

router.post('/token', optionalAuth, createToken);

module.exports = router;
