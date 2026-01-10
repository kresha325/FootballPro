const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const { Op } = require('sequelize');

// Get total unread messages for current user
router.get('/unread-count', auth, async (req, res) => {
  try {
    // Find all messages sent to the user that are not read
    const count = await Message.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    });
    res.json({ count });
  } catch (err) {
    console.error('Get unread messages count error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
