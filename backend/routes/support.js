'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { openPriorityChat } = require('../controllers/support');

router.post('/priority-chat', auth, openPriorityChat);

module.exports = router;
