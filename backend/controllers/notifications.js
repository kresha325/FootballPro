'use strict';

const notifications = require('../services/notifications/service');
const User = require('../models/User');

function http(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      if (result && typeof result.status === 'number' && result.body) {
        return res.status(result.status).json(result.body);
      }
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: 'Gabim në server' });
    }
  };
}

exports.getNotifications = http(async (req) => notifications.list(req.user.id, req.query || {}));

exports.getTournamentBadge = http(async (req) => {
  const { Op, literal } = require('sequelize');
  const Notification = require('../models/Notification');
  const now = new Date();
  try {
    const count = await Notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
        type: { [Op.ne]: 'message' },
        [Op.and]: [
          { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] },
          {
            [Op.or]: [
              { entityType: 'tournament', entityId: { [Op.ne]: null } },
              { type: 'tournament', entityId: { [Op.ne]: null } },
              { link: { [Op.iLike]: '%tournamentId=%' } },
              { link: { [Op.iLike]: '%/tournaments/%' } },
              literal(`COALESCE("metadata"->>'tournamentId', '') ~ '^[0-9]+$'`),
            ],
          },
        ],
      },
    });
    return { count: Number(count) || 0 };
  } catch (err) {
    const message = err?.original?.message || err?.message || '';
    if (message.includes('does not exist') || message.includes('metadata')) {
      return { count: 0 };
    }
    throw err;
  }
});

exports.getUnreadCount = http(async (req) => {
  try {
    return await notifications.unread(req.user.id, req.query?.category);
  } catch (err) {
    const message = err?.original?.message || err?.message || '';
    if (message.includes('Notifications') && message.includes('does not exist')) {
      return { count: 0, byCategory: {} };
    }
    throw err;
  }
});

exports.markAsRead = http(async (req) => notifications.markRead(req.user.id, req.params.id));
exports.markAsUnread = http(async (req) => notifications.markUnread(req.user.id, req.params.id));
exports.markAllAsRead = http(async (req) => notifications.markAllRead(req.user.id));
exports.deleteNotification = http(async (req) => notifications.remove(req.user.id, req.params.id));
exports.getPreferences = http(async (req) => notifications.getPreferences(req.user.id));
exports.updatePreferences = http(async (req) => notifications.savePreferences(req.user.id, req.body || {}));

exports.createNotification = async (data) => notifications.notify(data || {});

exports.notifyLike = async (postOwnerId, likerId, postId) => {
  if (Number(postOwnerId) === Number(likerId)) return null;
  const liker = await User.findByPk(likerId);
  const name = `${liker?.firstName || ''} ${liker?.lastName || ''}`.trim() || 'Dikush';
  return exports.createNotification({
    userId: postOwnerId,
    actorId: likerId,
    eventType: 'POST_LIKED',
    actorName: name,
    title: 'Pëlqim i ri',
    message: `${name} pëlqeu postimin tuaj`,
    link: `/feed?post=${postId}`,
    entityType: 'post',
    entityId: postId,
  });
};

exports.notifyComment = async (postOwnerId, commenterId, postId, commentText) => {
  if (Number(postOwnerId) === Number(commenterId)) return null;
  const commenter = await User.findByPk(commenterId);
  const name = `${commenter?.firstName || ''} ${commenter?.lastName || ''}`.trim() || 'Dikush';
  const text = String(commentText || '');
  return exports.createNotification({
    userId: postOwnerId,
    actorId: commenterId,
    eventType: 'POST_COMMENTED',
    title: 'Koment i ri',
    message: `${name} komentoi: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    link: `/feed?post=${postId}`,
    entityType: 'post',
    entityId: postId,
  });
};

exports.notifyFollow = async (followedId, followerId, options = {}) => {
  if (Number(followedId) === Number(followerId)) return null;
  const follower = await User.findByPk(followerId);
  const name = `${follower?.firstName || ''} ${follower?.lastName || ''}`.trim() || 'Dikush';
  const accepted = Boolean(options.accepted);
  return exports.createNotification({
    userId: followedId,
    actorId: followerId,
    eventType: accepted ? 'FOLLOW_ACCEPTED' : 'FOLLOW',
    title: accepted ? 'Ndjekja u pranua' : 'Ndjekës i ri',
    message: accepted ? `${name} pranoi ndjekjen` : `${name} filloi t'ju ndjekë`,
    link: `/profile/${followerId}`,
    entityType: 'user',
    entityId: followerId,
    idempotencyKey: `follow:${followerId}:user:${followedId}`,
  });
};

exports.notifyMessage = async (recipientId, senderId, message) => {
  const sender = await User.findByPk(senderId);
  if (!sender) return null;
  const text = typeof message === 'string' ? message : '';
  const name = `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
  return exports.createNotification({
    userId: recipientId,
    actorId: senderId,
    eventType: 'MESSAGE',
    title: 'Mesazh i ri',
    message: `${name}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
    link: '/messaging',
    entityType: 'message',
    entityId: senderId,
  });
};

exports.notifyTournament = async (userId, tournamentId, title, message, opts = {}) => {
  const tid = Number(tournamentId);
  return exports.createNotification({
    userId,
    eventType: opts.eventType || 'TOURNAMENT_UPDATE',
    title: title || 'Përditësim i turneut',
    message: message || '',
    link: Number.isFinite(tid) && tid > 0 ? `/tournaments?tournamentId=${tid}` : '/tournaments',
    entityType: 'tournament',
    entityId: tid || tournamentId,
    idempotencyKey: opts.idempotencyKey || null,
    metadata: { tournamentId: tid || tournamentId },
  });
};

exports.sendNotification = async (userId, title, body, data = {}) => {
  await notifications.sendPush(userId, title, body, data);
};
