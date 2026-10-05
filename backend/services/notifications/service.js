'use strict';

const { Op, fn, col } = require('sequelize');
const policy = require('./policy');

const EXTENDED_FIELDS = ['eventType', 'category', 'priority', 'readAt', 'expiresAt', 'idempotencyKey'];

function actorName(user) {
  if (!user) return 'Dikush';
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || 'Dikush';
}

function tokenKeyOf(platform, token) {
  if (token == null || token === '') return '';
  if (platform === 'web') {
    const endpoint = token && typeof token === 'object' ? token.endpoint : '';
    const raw = endpoint || (typeof token === 'string' ? token : JSON.stringify(token));
    return String(raw).slice(0, 191);
  }
  return String(token).slice(0, 191);
}

function visibleClause(userId, { unreadOnly, category, now }) {
  const where = {
    userId,
    type: { [Op.ne]: 'message' },
    [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
  };
  if (unreadOnly) where.isRead = false;
  if (category) where.category = category;
  return where;
}

function sequelizeRepo() {
  const Notification = require('../../models/Notification');
  const User = require('../../models/User');
  const NotificationPreference = require('../../models/NotificationPreference');
  const PushDevice = require('../../models/PushDevice');

  return {
    async findByIdempotency(key) {
      if (!key) return null;
      try {
        return await Notification.findOne({ where: { idempotencyKey: key } });
      } catch (err) {
        if (!policy.isSchemaGap(err)) throw err;
        return null;
      }
    },
    async findRecentDuplicate(userId, key) {
      if (!key || !userId) return null;
      const recent = await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: 40,
      });
      return recent.find((row) => row.idempotencyKey === key || row.metadata?.idempotencyKey === key) || null;
    },
    async findAggregate(userId, type, entityType, entityId) {
      return Notification.findOne({
        where: { userId, type, entityType, entityId, isRead: false },
        order: [['createdAt', 'DESC']],
      });
    },
    async insert(data) {
      try {
        return await Notification.create(data);
      } catch (err) {
        if (policy.isUniqueViolation(err) && data.idempotencyKey) {
          const existing = await Notification.findOne({ where: { idempotencyKey: data.idempotencyKey } });
          if (existing) {
            existing.duplicate = true;
            return existing;
          }
        }
        if (!policy.isSchemaGap(err)) throw err;
        const legacy = { ...data, metadata: { ...(data.metadata || {}) } };
        for (const field of EXTENDED_FIELDS) {
          if (data[field] != null) legacy.metadata[field] = data[field];
          delete legacy[field];
        }
        return Notification.create(legacy);
      }
    },
    async reload(id) {
      return Notification.findByPk(id, {
        include: [{ model: User, as: 'actor', attributes: ['id', 'firstName', 'lastName'] }],
      });
    },
    async list(userId, query) {
      const now = new Date();
      const parsed = policy.parseListQuery(query);
      const run = (where) => Notification.findAndCountAll({
        where,
        include: [{ model: User, as: 'actor', attributes: ['id', 'firstName', 'lastName'] }],
        order: [['createdAt', 'DESC']],
        limit: parsed.limit,
        offset: parsed.offset,
      });
      try {
        const result = await run(visibleClause(userId, { ...parsed, now }));
        return { ...parsed, rows: result.rows, total: result.count };
      } catch (err) {
        if (!policy.isSchemaGap(err)) throw err;
        const where = { userId, type: { [Op.ne]: 'message' } };
        if (parsed.unreadOnly) where.isRead = false;
        const result = await run(where);
        return { ...parsed, rows: result.rows, total: result.count };
      }
    },
    async unread(userId, category) {
      const now = new Date();
      const base = () => {
        const where = visibleClause(userId, { unreadOnly: true, category, now });
        return where;
      };
      try {
        const count = await Notification.count({ where: base() });
        let byCategory = {};
        try {
          const grouped = await Notification.findAll({
            attributes: ['category', [fn('COUNT', col('id')), 'total']],
            where: visibleClause(userId, { unreadOnly: true, category: null, now }),
            group: ['category'],
            raw: true,
          });
          byCategory = {};
          for (const row of grouped) {
            const key = row.category || 'SYSTEM';
            byCategory[key] = Number(row.total) || 0;
          }
        } catch (_groupErr) {
          byCategory = {};
        }
        return { count, byCategory };
      } catch (err) {
        if (!policy.isSchemaGap(err)) throw err;
        const where = { userId, isRead: false, type: { [Op.ne]: 'message' } };
        const count = await Notification.count({ where });
        return { count, byCategory: {} };
      }
    },
    async findOwned(userId, id) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || numericId <= 0) return { invalid: true };
      const row = await Notification.findOne({ where: { id: numericId, userId } });
      return { row };
    },
    async markAll(userId) {
      const now = new Date();
      await Notification.update(
        { isRead: true, readAt: now },
        { where: { userId, isRead: false, type: { [Op.ne]: 'message' } } }
      );
    },
    async destroyOwned(row) {
      await row.destroy();
    },
    async loadPreferences(userId) {
      try {
        return await NotificationPreference.findAll({ where: { userId } });
      } catch (err) {
        if (policy.isSchemaGap(err)) return [];
        throw err;
      }
    },
    async savePreferences(userId, preferences) {
      for (const row of preferences) {
        const [record] = await NotificationPreference.findOrCreate({
          where: { userId, category: row.category },
          defaults: { userId, category: row.category, inApp: row.inApp, push: row.push, email: row.email },
        });
        await record.update({ inApp: row.inApp, push: row.push, email: row.email });
      }
    },
    async preferenceFor(userId, category) {
      try {
        return await NotificationPreference.findOne({ where: { userId, category } });
      } catch (err) {
        if (policy.isSchemaGap(err)) return null;
        throw err;
      }
    },
    async loadUser(userId) {
      return User.findByPk(userId);
    },
    async listDevices(userId) {
      try {
        return await PushDevice.findAll({ where: { userId, enabled: true } });
      } catch (err) {
        if (policy.isSchemaGap(err)) return [];
        throw err;
      }
    },
    async upsertDevice({ userId, platform, token, deviceId }) {
      const key = tokenKeyOf(platform, token);
      if (!key) return null;
      const now = new Date();
      let row = null;
      try {
        row = await PushDevice.findOne({ where: { tokenKey: key } });
      } catch (err) {
        if (policy.isSchemaGap(err)) return { legacyOnly: true };
        throw err;
      }
      if (!row && deviceId) {
        row = await PushDevice.findOne({ where: { userId, deviceId, platform } });
      }
      if (row) {
        await row.update({
          userId,
          platform,
          token: platform === 'web' ? JSON.stringify(token) : String(token),
          tokenKey: key,
          deviceId: deviceId || row.deviceId,
          enabled: true,
          lastSeenAt: now,
          invalidatedAt: null,
        });
      } else {
        row = await PushDevice.create({
          userId,
          platform,
          token: platform === 'web' ? JSON.stringify(token) : String(token),
          tokenKey: key,
          deviceId: deviceId || null,
          enabled: true,
          lastSeenAt: now,
        });
      }
      return row;
    },
    async disableToken(tokenKey) {
      if (!tokenKey) return;
      try {
        await PushDevice.update(
          { enabled: false, invalidatedAt: new Date() },
          { where: { tokenKey: String(tokenKey).slice(0, 191) } }
        );
      } catch (err) {
        if (!policy.isSchemaGap(err)) console.warn('disable push token:', err?.message || err);
      }
    },
    async disableUserDevice({ userId, platform, token, deviceId }) {
      const key = token ? tokenKeyOf(platform, token) : '';
      try {
        if (key) {
          await PushDevice.update(
            { enabled: false, invalidatedAt: new Date() },
            { where: { userId, tokenKey: key } }
          );
        } else if (deviceId) {
          await PushDevice.update(
            { enabled: false, invalidatedAt: new Date() },
            { where: { userId, deviceId, platform } }
          );
        }
        const user = await User.findByPk(userId);
        if (!user) return;
        if (platform === 'mobile') {
          const legacy = user.pushTokenMobile;
          if (!token || legacy === token || (key && legacy === token)) {
            const next = await PushDevice.findOne({
              where: { userId, platform: 'mobile', enabled: true },
              order: [['lastSeenAt', 'DESC']],
            });
            user.pushTokenMobile = next ? next.token : null;
          }
        } else if (platform === 'web') {
          user.pushTokenWeb = null;
        }
        await user.save();
      } catch (err) {
        if (!policy.isSchemaGap(err)) throw err;
        const user = await User.findByPk(userId);
        if (!user) return;
        if (platform === 'mobile') user.pushTokenMobile = null;
        if (platform === 'web') user.pushTokenWeb = null;
        await user.save();
      }
    },
    async syncLegacyToken(userId, platform, token) {
      const user = await User.findByPk(userId);
      if (!user) return;
      if (platform === 'mobile') user.pushTokenMobile = token || null;
      if (platform === 'web') user.pushTokenWeb = token || null;
      await user.save();
    },
  };
}

async function defaultPush(userId, title, body, data, badge) {
  const User = require('../../models/User');
  const { Expo } = require('expo-server-sdk');
  let webPush = null;
  try {
    webPush = require('web-push');
  } catch (_err) {
    webPush = null;
  }
  const expo = new Expo();
  const user = await User.findByPk(userId);
  if (!user) return { sent: 0 };

  const repo = sequelizeRepo();
  const devices = await repo.listDevices(userId);
  const mobile = new Set();
  const web = [];

  for (const device of devices) {
    if (device.platform === 'mobile' && device.token && Expo.isExpoPushToken(device.token)) {
      mobile.add(device.token);
    } else if (device.platform === 'web' && device.token) {
      try {
        web.push(JSON.parse(device.token));
      } catch (_err) {
        /* ignore malformed subscription */
      }
    }
  }
  if (user.pushTokenMobile && Expo.isExpoPushToken(user.pushTokenMobile)) {
    mobile.add(user.pushTokenMobile);
  }
  if (user.pushTokenWeb && typeof user.pushTokenWeb === 'object') {
    web.push(user.pushTokenWeb);
  }

  const priority = policy.pushPriority(data?.priority);
  const messages = [...mobile].map((to) => ({
    to,
    sound: 'default',
    title: title || 'X TALENTI',
    body: body || '',
    data,
    badge,
    priority,
  }));

  let sent = 0;
  if (messages.length && Expo) {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
            repo.disableToken(chunk[index]?.to).catch(() => {});
            if (user.pushTokenMobile === chunk[index]?.to) {
              user.pushTokenMobile = null;
              user.save().catch(() => {});
            }
          } else if (ticket?.status === 'ok') {
            sent += 1;
          }
        });
      } catch (err) {
        console.warn('Expo push chunk failed:', err?.message || err);
      }
    }
  }

  if (webPush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      webPush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@jonsport.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } catch (_err) {
      /* already configured */
    }
    const payload = JSON.stringify({ title, body, icon: '/icon.png', data, badge });
    for (const subscription of web) {
      try {
        await webPush.sendNotification(subscription, payload);
        sent += 1;
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          const endpoint = subscription?.endpoint;
          if (endpoint) repo.disableToken(endpoint).catch(() => {});
          if (user.pushTokenWeb && user.pushTokenWeb.endpoint === endpoint) {
            user.pushTokenWeb = null;
            user.save().catch(() => {});
          }
        } else {
          console.warn('Web push failed:', err?.message || err);
        }
      }
    }
  }
  return { sent };
}

async function defaultEmail(user, title, message, link) {
  if (!user?.email) return { sent: false };
  try {
    const { sendEmail } = require('../emailService');
    await sendEmail(user.email, 'importantNotice', user.firstName || 'there', title, message, link || '');
    return { sent: true };
  } catch (err) {
    console.warn('Notification email failed:', err?.message || err);
    return { sent: false };
  }
}

function defaultEmit(userId, notification, unread) {
  try {
    const { getIo } = require('../../utils/socket');
    const io = getIo && getIo();
    if (!io) return;
    io.to(String(userId)).emit('notification:new', notification);
    io.to(String(userId)).emit('notification:unread', unread);
  } catch (err) {
    console.warn('Notification socket emit failed:', err?.message || err);
  }
}

async function bellBadge(userId) {
  try {
    const Notification = require('../../models/Notification');
    const notifUnread = await Notification.count({
      where: { userId, isRead: false, type: { [Op.ne]: 'message' } },
    });
    let badge = Number(notifUnread) || 0;
    try {
      const { Conversation, ConversationMember } = require('../../models/Conversation');
      const Message = require('../../models/Message');
      const conversations = await Conversation.findAll({
        attributes: ['id'],
        include: [{
          model: ConversationMember,
          as: 'memberships',
          where: { userId },
          attributes: ['lastReadAt'],
        }],
      });
      const msgCounts = await Promise.all(
        conversations.map(async (conv) => {
          const membership = conv.memberships && conv.memberships[0];
          if (!membership) return 0;
          return Message.count({
            where: {
              conversationId: conv.id,
              senderId: { [Op.ne]: userId },
              deleted: false,
              createdAt: { [Op.gt]: membership.lastReadAt || new Date(0) },
            },
          });
        })
      );
      badge += msgCounts.reduce((sum, value) => sum + value, 0);
    } catch (_msgErr) {
      /* messaging badge is best-effort */
    }
    return badge;
  } catch (_err) {
    return 0;
  }
}

function createRuntime(overrides = {}) {
  const repo = () => overrides.repo || sequelizeRepo();
  const push = overrides.push || defaultPush;
  const email = overrides.email || defaultEmail;
  const emit = overrides.emit || defaultEmit;

  async function channelsFor(userId, eventType) {
    const def = policy.eventDef(eventType) || policy.EVENTS.SYSTEM_NOTICE;
    let stored = null;
    try {
      stored = await repo().preferenceFor(userId, def.category);
    } catch (_err) {
      stored = null;
    }
    const preference = stored
      ? {
          category: def.category,
          inApp: stored.inApp !== false,
          push: stored.push !== false,
          email: Boolean(stored.email),
        }
      : null;
    return policy.deliveryDecision(eventType, preference);
  }

  async function notify(input = {}) {
    const eventType = policy.resolveEventType(input);
    const def = policy.eventDef(eventType) || policy.EVENTS.SYSTEM_NOTICE;
    const userId = Number(input.userId);
    const actorId = input.actorId != null && input.actorId !== '' ? Number(input.actorId) : null;
    if (!Number.isFinite(userId) || userId <= 0) return null;
    if (Number.isFinite(actorId) && actorId === userId && !def.allowSelf && input.allowSelf !== true) {
      return null;
    }

    const decision = await channelsFor(userId, eventType);
    if (input.skipPush) decision.push = false;
    if (input.skipEmail) decision.email = false;
    if (!policy.anyChannel(decision)) return null;

    const type = policy.legacyTypeFor(eventType, input.type);
    const entityType = input.entityType || null;
    const entityId = input.entityId != null && input.entityId !== '' ? Number(input.entityId) : null;
    const idempotencyKey = input.idempotencyKey || null;
    const metadata = {
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
      eventType,
      category: def.category,
      priority: decision.priority,
      idempotencyKey,
    };
    const link = policy.buildEntityLink({
      entityType,
      entityId,
      link: input.link,
      metadata,
    });

    if (idempotencyKey) {
      const existing = (await repo().findByIdempotency(idempotencyKey))
        || (await repo().findRecentDuplicate(userId, idempotencyKey));
      if (existing) {
        const presented = policy.presentNotification(existing);
        presented.duplicate = true;
        return presented;
      }
    }

    if (def.aggregate && entityId && decision.inApp) {
      const candidate = await repo().findAggregate(userId, type, entityType, entityId);
      if (candidate && policy.withinAggregateWindow(candidate.createdAt)) {
        const count = Number(candidate.metadata?.count || 1) + 1;
        const name = input.actorName || metadata.actorName || 'Dikush';
        const message = policy.aggregateCopy(def.aggregate, count, name);
        const nextMeta = { ...(candidate.metadata || {}), ...metadata, count };
        if (typeof candidate.update === 'function') {
          await candidate.update({ message, metadata: nextMeta, title: input.title || candidate.title });
        }
        candidate.message = message;
        candidate.metadata = nextMeta;
        candidate.aggregated = true;
        const presented = policy.presentNotification(candidate);
        presented.aggregated = true;
        if (decision.bell) {
          const unread = await repo().unread(userId);
          emit(userId, presented, { count: unread.count, byCategory: unread.byCategory });
        }
        return presented;
      }
    }

    const record = {
      userId,
      actorId: Number.isFinite(actorId) ? actorId : null,
      type,
      eventType,
      category: def.category,
      priority: decision.priority,
      title: input.title || 'X TALENTI',
      message: input.message || '',
      link,
      entityType,
      entityId: Number.isFinite(entityId) ? entityId : null,
      isRead: decision.inApp ? false : true,
      readAt: decision.inApp ? null : new Date(),
      expiresAt: input.expiresAt || null,
      idempotencyKey,
      metadata: { ...metadata, count: def.aggregate ? 1 : undefined },
    };

    let row;
    try {
      row = await repo().insert(record);
    } catch (err) {
      console.error('Create notification error:', err?.message || err);
      throw err;
    }
    if (row?.duplicate) {
      const presented = policy.presentNotification(row);
      presented.duplicate = true;
      return presented;
    }

    let full = row;
    try {
      full = (await repo().reload(row.id)) || row;
    } catch (_err) {
      full = row;
    }
    const presented = policy.presentNotification(full);

    if (decision.bell && decision.inApp) {
      try {
        const unread = await repo().unread(userId);
        emit(userId, presented, { count: unread.count, byCategory: unread.byCategory });
      } catch (err) {
        console.warn('Notification realtime failed:', err?.message || err);
      }
    }

    if (decision.push) {
      await deliverPush(userId, presented, decision);
    }
    if (decision.email) {
      try {
        const user = await repo().loadUser(userId);
        await email(user, presented.title, presented.message, presented.link);
      } catch (err) {
        console.warn('Notification email failed:', err?.message || err);
      }
    }
    return presented;
  }

  async function deliverPush(userId, presented, decision) {
    try {
      const badge = await bellBadge(userId);
      await push(userId, presented.title, presented.message, {
        type: presented.type,
        eventType: presented.eventType,
        category: presented.category,
        priority: decision.priority,
        link: presented.link || '',
        entityType: presented.entityType || '',
        entityId: presented.entityId != null ? String(presented.entityId) : '',
        actorId: presented.actorId != null ? String(presented.actorId) : '',
        notificationId: presented.id != null ? String(presented.id) : '',
      }, badge);
    } catch (err) {
      console.warn('Push after notification failed:', err?.message || err);
    }
  }

  async function list(userId, query) {
    const result = await repo().list(userId, query);
    return {
      notifications: result.rows.map(policy.presentNotification),
      total: result.total,
      page: result.page,
      pages: Math.max(1, Math.ceil(result.total / result.limit)),
      limit: result.limit,
    };
  }

  async function unread(userId, category) {
    return repo().unread(userId, category);
  }

  async function markRead(userId, id) {
    const found = await repo().findOwned(userId, id);
    if (found.invalid) return { status: 400, body: { msg: 'ID e pavlefshme' } };
    if (!found.row) return { status: 404, body: { msg: 'Njoftimi nuk u gjet' } };
    const now = new Date();
    await found.row.update({ isRead: true, readAt: found.row.readAt || now });
    return { status: 200, body: { msg: 'Njoftimi u shënua si i lexuar', notification: policy.presentNotification(found.row) } };
  }

  async function markUnread(userId, id) {
    const found = await repo().findOwned(userId, id);
    if (found.invalid) return { status: 400, body: { msg: 'ID e pavlefshme' } };
    if (!found.row) return { status: 404, body: { msg: 'Njoftimi nuk u gjet' } };
    await found.row.update({ isRead: false, readAt: null });
    return { status: 200, body: { msg: 'Njoftimi u shënua si i palexuar', notification: policy.presentNotification(found.row) } };
  }

  async function markAllRead(userId) {
    await repo().markAll(userId);
    return { status: 200, body: { msg: 'Të gjitha njoftimet u shënuan si të lexuara', count: 0 } };
  }

  async function remove(userId, id) {
    const found = await repo().findOwned(userId, id);
    if (found.invalid) return { status: 400, body: { msg: 'ID e pavlefshme' } };
    if (!found.row) return { status: 404, body: { msg: 'Njoftimi nuk u gjet' } };
    await repo().destroyOwned(found.row);
    return { status: 200, body: { msg: 'Njoftimi u fshi' } };
  }

  async function getPreferences(userId) {
    const rows = await repo().loadPreferences(userId);
    return { preferences: policy.preferenceView(rows) };
  }

  async function savePreferences(userId, body) {
    const parsed = policy.sanitizePreferences(body);
    if (!parsed.ok) return { status: 400, body: { msg: parsed.msg } };
    await repo().savePreferences(userId, parsed.preferences);
    return { status: 200, body: { preferences: policy.preferenceView(parsed.preferences) } };
  }

  async function registerDevice({ userId, platform, token, deviceId }) {
    const normalized = platform === 'web' ? 'web' : 'mobile';
    const cleared = token == null || token === '';
    if (cleared) {
      await repo().disableUserDevice({
        userId,
        platform: normalized,
        token: null,
        deviceId: deviceId || null,
      });
      if (!deviceId) {
        const user = await repo().loadUser(userId);
        if (user) {
          const legacy = normalized === 'mobile' ? user.pushTokenMobile : null;
          if (legacy) await repo().disableToken(tokenKeyOf(normalized, legacy));
        }
        await repo().syncLegacyToken(userId, normalized, null);
      }
      return { cleared: true };
    }
    if (normalized === 'mobile') {
      let Expo;
      try {
        Expo = require('expo-server-sdk').Expo;
      } catch (_err) {
        Expo = null;
      }
      if (Expo && !Expo.isExpoPushToken(token)) {
        return { error: 'invalid_token', status: 400, msg: 'Push token i pavlefshëm' };
      }
    }
    await repo().upsertDevice({ userId, platform: normalized, token, deviceId });
    await repo().syncLegacyToken(userId, normalized, token);
    return { cleared: false };
  }

  async function sendPush(userId, title, body, data = {}) {
    try {
      const badge = typeof overrides.badge === 'function' ? await overrides.badge(userId) : await bellBadge(userId);
      await push(userId, title, body || '', {
        ...data,
        type: data.type || '',
        link: data.link || '',
        entityType: data.entityType || '',
        entityId: data.entityId != null ? String(data.entityId) : '',
      }, badge);
    } catch (err) {
      console.warn('sendPush failed:', err?.message || err);
    }
  }

  return {
    notify,
    list,
    unread,
    markRead,
    markUnread,
    markAllRead,
    remove,
    getPreferences,
    savePreferences,
    registerDevice,
    sendPush,
  };
}

const runtime = createRuntime();

module.exports = {
  ...runtime,
  createRuntime,
  tokenKeyOf,
};
