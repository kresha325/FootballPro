const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  getTournamentBadge,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
} = require('../controllers/notifications');

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.get('/tournament-badge', auth, getTournamentBadge);
router.get('/preferences', auth, getPreferences);
router.put('/preferences', auth, updatePreferences);

router.put('/mark-all-read', auth, markAllAsRead);
router.put('/read-all', auth, markAllAsRead);
router.post('/mark-all-read', auth, markAllAsRead);
router.post('/read-all', auth, markAllAsRead);

router.put('/:id/read', auth, markAsRead);
router.post('/:id/read', auth, markAsRead);
router.put('/:id/unread', auth, markAsUnread);
router.post('/:id/unread', auth, markAsUnread);
router.delete('/:id', auth, deleteNotification);

module.exports = router;
