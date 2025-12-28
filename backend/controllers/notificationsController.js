const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await Notification.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      notifications: notifications.rows,
      total: notifications.count,
      page: parseInt(page),
      pages: Math.ceil(notifications.count / limit),
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });
    res.json({ count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    await notification.update({ isRead: true });
    res.json({ msg: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      {
        where: {
          userId: req.user.id,
          isRead: false,
        },
      }
    );
    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    await notification.destroy();
    res.json({ msg: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Create notification (internal use)
exports.createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    
    // Get notification with actor info
    const fullNotification = await Notification.findByPk(notification.id, {
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
    });

    return fullNotification;
  } catch (err) {
    console.error('Create notification error:', err);
    throw err;
  }
};

// Helper functions for creating specific notification types
exports.notifyLike = async (postOwnerId, likerId, postId) => {
  if (postOwnerId === likerId) return; // Don't notify self

  const liker = await User.findByPk(likerId);
  return exports.createNotification({
    userId: postOwnerId,
    actorId: likerId,
    type: 'like',
    title: 'New Like',
    message: `${liker.firstName} ${liker.lastName} liked your post`,
    link: `/posts/${postId}`,
    entityType: 'post',
    entityId: postId,
  });
};

exports.notifyComment = async (postOwnerId, commenterId, postId, commentText) => {
  if (postOwnerId === commenterId) return; // Don't notify self

  const commenter = await User.findByPk(commenterId);
  return exports.createNotification({
    userId: postOwnerId,
    actorId: commenterId,
    type: 'comment',
    title: 'New Comment',
    message: `${commenter.firstName} ${commenter.lastName} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
    link: `/posts/${postId}`,
    entityType: 'post',
    entityId: postId,
  });
};

exports.notifyFollow = async (followedId, followerId) => {
  const follower = await User.findByPk(followerId);
  return exports.createNotification({
    userId: followedId,
    actorId: followerId,
    type: 'follow',
    title: 'New Follower',
    message: `${follower.firstName} ${follower.lastName} started following you`,
    link: `/profile/${followerId}`,
    entityType: 'user',
    entityId: followerId,
  });
};

exports.notifyMessage = async (recipientId, senderId, message) => {
  const sender = await User.findByPk(senderId);
  return exports.createNotification({
    userId: recipientId,
    actorId: senderId,
    type: 'message',
    title: 'New Message',
    message: `${sender.firstName} ${sender.lastName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
    link: `/messages/${senderId}`,
    entityType: 'message',
    entityId: senderId,
  });
};

exports.notifyTournament = async (userId, tournamentId, title, message) => {
  return exports.createNotification({
    userId,
    type: 'tournament',
    title,
    message,
    link: `/tournaments/${tournamentId}`,
    entityType: 'tournament',
    entityId: tournamentId,
  });
};

exports.notifyAchievement = async (userId, achievementId, achievementName) => {
  return exports.createNotification({
    userId,
    type: 'achievement',
    title: 'Achievement Unlocked!',
    message: `Congratulations! You've earned the "${achievementName}" achievement!`,
    link: `/profile/${userId}?tab=achievements`,
    entityType: 'achievement',
    entityId: achievementId,
  });
};
