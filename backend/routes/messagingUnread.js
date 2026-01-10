const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const { Op } = require('sequelize');

// Get total unread messages for current user
router.get('/unread-count', auth, async (req, res) => {
  // Unread message count logic disabled (isRead column removed)
  // Always return 0 to avoid backend error
  res.json({ count: 0 });
});

module.exports = router;
