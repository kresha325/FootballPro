const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sequelize = require('../config/database');
const { sumUnreadForUser } = require('../utils/messagingUnread');

// Total unread messages across all conversations (for tab badge, etc.)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const total = await sumUnreadForUser(sequelize, req.user.id);
    res.json({ count: total, unreadCount: total });
  } catch (err) {
    console.error('messaging unread-count error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
