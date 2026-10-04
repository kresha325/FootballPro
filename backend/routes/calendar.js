const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getCalendar } = require('../controllers/matches');

router.get('/', auth.optionalAuth, getCalendar);

module.exports = router;
