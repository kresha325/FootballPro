const { Expo } = require('expo-server-sdk');
const webPush = require('web-push');
const { Op } = require('sequelize');
const User = require('../models/User');
const Notification = require('../models/Notification');

const expo = new Expo();

// Set VAPID keys for web push (you need to generate these)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@jonsport.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    // Chat/DM përdor badge në messaging; mos i përzier me njoftimet e ziles.
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
    const message = err?.original?.message || err?.message || '';
    if (message.includes('Notifications') && message.includes('does not exist')) {
      return res.json({ count: 0 });
    }
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

// Create notification (internal use) + optional push
exports.createNotification = async (data) => {
  try {
    const { skipPush, ...persist } = data || {};
    const notification = await Notification.create(persist);
    
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

    // Push to mobile/web when token exists (skip if caller will send separately)
    if (!skipPush && persist.userId) {
      try {
        let body = persist.message || '';
        if (persist.type === 'message') {
          body = 'Ke një mesazh të ri';
        }
        await exports.sendNotification(persist.userId, persist.title || 'XTalenti', body, {
          type: persist.type,
          link: persist.link,
          entityType: persist.entityType,
          entityId: persist.entityId,
          actorId: persist.actorId,
          ...(persist.metadata && typeof persist.metadata === 'object' ? { metadata: persist.metadata } : {}),
        });
      } catch (pushErr) {
        console.warn('Push after createNotification failed:', pushErr?.message || pushErr);
      }
    }

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
    link: `/feed?post=${postId}`,
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
    link: `/feed?post=${postId}`,
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
  if (!sender) return null;
  const text = typeof message === 'string' ? message : '';
  return exports.createNotification({
    userId: recipientId,
    actorId: senderId,
    type: 'message',
    title: 'Mesazh i ri',
    message: `${sender.firstName} ${sender.lastName}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
    link: `/messaging`,
    entityType: 'message',
    entityId: senderId,
  });
};

exports.notifyTournament = async (userId, tournamentId, title, message) => {
  return exports.createNotification({
    userId,
    type: 'tournament',
    title: title || 'Përditësim i turneut',
    message: message || '',
    link: `/tournaments/${tournamentId}`,
    entityType: 'tournament',
    entityId: tournamentId,
  });
};

exports.sendNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) return;

    const type = String(data?.type || '').toLowerCase();
    const safeBody = type === 'message' ? 'Ke një mesazh të ri' : body;

    // Send to mobile
    if (user.pushTokenMobile && Expo.isExpoPushToken(user.pushTokenMobile)) {
      const message = {
        to: user.pushTokenMobile,
        sound: 'default',
        title,
        body: safeBody,
        data,
      };
      await expo.sendPushNotificationsAsync([message]);
    }

    // Send to web
    if (user.pushTokenWeb) {
      const subscription = user.pushTokenWeb;
      const payload = JSON.stringify({
        title,
        body: safeBody,
        icon: '/icon.png', // Add icon
        data,
      });
      await webPush.sendNotification(subscription, payload);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};