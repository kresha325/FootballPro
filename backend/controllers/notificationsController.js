const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id, type: { [Op.ne]: 'message' } };
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
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
        type: { [Op.ne]: 'message' },
      },
    });
    res.json({ count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
      return res.status(404).json({ msg: 'Njoftimi nuk u gjet' });
    }

    await notification.update({ isRead: true });
    res.json({ msg: 'Njoftimi u shënua si i lexuar' });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
    res.json({ msg: 'Të gjitha njoftimet u shënuan si të lexuara' });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
      return res.status(404).json({ msg: 'Njoftimi nuk u gjet' });
    }

    await notification.destroy();
    res.json({ msg: 'Njoftimi u fshi' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
    title: 'Pëlqim i ri',
    message: `${liker.firstName} ${liker.lastName} pëlqeu postimin tuaj`,
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
    title: 'Koment i ri',
    message: `${commenter.firstName} ${commenter.lastName} komentoi: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
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
    title: 'Ndjekës i ri',
    message: `${follower.firstName} ${follower.lastName} filloi t'ju ndjekë`,
    link: `/profile/${followerId}`,
    entityType: 'user',
    entityId: followerId,
  });
};

exports.notifyMessage = async (recipientId, senderId, message) => {
  const sender = await User.findByPk(senderId);
  let preview = '';
  if (typeof message === 'string' && message) {
    preview = message.substring(0, 50) + (message.length > 50 ? '...' : '');
  } else if (message && typeof message.content === 'string' && message.content.trim()) {
    const c = message.content.trim();
    preview = c.substring(0, 50) + (c.length > 50 ? '...' : '');
  } else if (message && message.fileName) {
    preview = `[Media] ${message.fileName}`;
  } else {
    preview = '[Mesazh media]';
  }
  return exports.createNotification({
    userId: recipientId,
    actorId: senderId,
    type: 'message',
    title: 'Mesazh i ri',
    message: `${sender.firstName} ${sender.lastName}: ${preview}`,
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
    title: 'Arritje e zhbllokuar!',
    message: `Urime! Fitove arritjen "${achievementName}"!`,
    link: `/profile/${userId}?tab=achievements`,
    entityType: 'achievement',
    entityId: achievementId,
  });
};
