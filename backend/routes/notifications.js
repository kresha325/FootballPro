const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notifications');

// Get all notifications for current user
router.get('/', auth, getNotifications);

// Get unread count
router.get('/unread-count', auth, getUnreadCount);

// Mark notification as read
router.put('/:id/read', auth, markAsRead);

// Mark all as read
router.put('/mark-all-read', auth, markAllAsRead);

// Delete notification
router.delete('/:id', auth, deleteNotification);

module.exports = router;
