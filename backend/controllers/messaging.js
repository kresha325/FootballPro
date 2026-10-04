const Message = require('../models/Message');
const MessageReaction = require('../models/MessageReaction');
const { Conversation, ConversationMember } = require('../models/Conversation');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { sendEmail } = require('../services/emailService');
const { sendNotification } = require('./notifications');
const { Op, QueryTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const { toAbsoluteUploadsUrl } = require('../utils/url');
const { requireConversationMember } = require('../utils/conversationAcl');
const { validateMessageText, escapeLike, safeDisplayFileName } = require('../utils/messageContent');
const { inspectUploadedFile, discardUpload } = require('../utils/messageUpload');
const { DIRECT_PAIR_SQL, pairKey, conversationIdFromRow } = require('../utils/directConversation');
const {
  normalizeReactionEmoji,
  reactionToggleDecision,
  summarizeReactions,
  redactReply,
} = require('../utils/messageReactions');
const { authorizeGroupAction } = require('../utils/groupPermissions');
const { unreadCountsByConversation } = require('../utils/messagingUnread');
const { userIsViewingConversation } = require('../utils/conversationPresence');
const { isUserOnline } = require('../utils/socket');

/** Sender + Profile për avatar në chat */
const SENDER_WITH_PROFILE = {
  model: User,
  as: 'sender',
  attributes: ['id', 'firstName', 'lastName', 'verified'],
  include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
};

const REPLY_TO_WITH_SENDER = {
  model: Message,
  as: 'replyTo',
  attributes: ['id', 'content', 'senderId', 'type', 'fileUrl', 'fileName', 'deleted'],
  include: [
    {
      model: User,
      as: 'sender',
      attributes: ['id', 'firstName', 'lastName', 'verified'],
      include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
    },
  ],
};

function shapeSender(sender, req) {
  if (!sender) return null;
  const plain = typeof sender.get === 'function' ? sender.get({ plain: true }) : { ...sender };
  const photo = plain.Profile?.profilePhoto;
  delete plain.Profile;
  plain.profilePhoto = photo ? toAbsoluteUploadsUrl(req, photo) : null;
  return plain;
}

function shapeMemberRow(member, req) {
  if (!member) return member;
  const plain = typeof member.get === 'function' ? member.get({ plain: true }) : { ...member };
  const photo = plain.Profile?.profilePhoto;
  delete plain.Profile;
  return {
    ...plain,
    profilePhoto: photo ? toAbsoluteUploadsUrl(req, photo) : null,
  };
}

function shapeMessage(message, req) {
  if (!message) return message;
  const plain = typeof message.get === 'function' ? message.get({ plain: true }) : { ...message };
  if (plain.sender) plain.sender = shapeSender(plain.sender, req);
  if (plain.deleted) {
    plain.content = null;
    plain.fileUrl = null;
    plain.fileName = null;
  }
  if (plain.replyTo) {
    const r = { ...plain.replyTo };
    if (r.sender) r.sender = shapeSender(r.sender, req);
    if (r.fileUrl && !r.deleted) r.fileUrl = toAbsoluteUploadsUrl(req, r.fileUrl);
    plain.replyTo = redactReply(r);
  }
  if (plain.fileUrl) plain.fileUrl = toAbsoluteUploadsUrl(req, plain.fileUrl);
  if (plain.reactions) {
    plain.reactions = summarizeReactions(plain.reactions, req?.user?.id);
  }
  return plain;
}

function memberRoleOf(member) {
  return member?.ConversationMember?.role || member?.conversation_members?.role || member?.memberRole || null;
}

function withMemberRoles(members, req) {
  if (!Array.isArray(members)) return members;
  return members.map((m) => {
    const shaped = shapeMemberRow(m, req);
    return { ...shaped, memberRole: memberRoleOf(m) };
  });
}

async function attachReactions(messages, userId) {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return list;
  const ids = list.map((m) => m.id).filter((id) => id != null);
  if (!ids.length) return list;
  let rows = [];
  try {
    rows = await MessageReaction.findAll({
      where: { messageId: { [Op.in]: ids } },
      attributes: ['messageId', 'userId', 'emoji'],
    });
  } catch (err) {
    console.error('Reaction lookup failed:', err.message);
    return list;
  }
  const grouped = new Map();
  for (const row of rows) {
    const key = Number(row.messageId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return list.map((message) => {
    const plain = message;
    plain.reactions = summarizeReactions(grouped.get(Number(plain.id)) || [], userId);
    return plain;
  });
}

function previewText(message) {
  if (!message) return null;
  if (message.deleted) return 'Mesazh i fshirë';
  const text = typeof message.content === 'string' ? message.content.trim() : '';
  if (text) return text;
  if (message.fileName) return message.fileName;
  if (message.type === 'image') return 'Foto';
  if (message.type === 'video') return 'Video';
  if (message.type === 'audio') return 'Audio';
  if (message.type === 'file') return 'Skedar';
  if (message.type === 'call') return 'Thirrje';
  return null;
}

async function blockedWith(userId, otherId) {
  if (!otherId || Number(otherId) === Number(userId)) return false;
  try {
    const { isEitherBlocked } = require('./moderation');
    return await isEitherBlocked(userId, otherId);
  } catch (_err) {
    return false;
  }
}

function emitConversation(event, conversationId, payload, userIds = []) {
  try {
    const io = require('../socket').getIo();
    if (!io || conversationId == null) return;
    io.to(`conversation-${conversationId}`).emit(event, payload);
    const ids = new Set((userIds || []).filter((id) => id != null).map((id) => String(id)));
    ids.forEach((id) => io.to(id).emit(event, payload));
  } catch (err) {
    console.warn(`Emit ${event} failed:`, err.message);
  }
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/messages/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'msg-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

exports.upload = upload;

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    // Two-step load so filtered memberships don't collapse belongsToMany `members`
    // (Sequelize often returns only the current user when both are joined together).
    const myMemberships = await ConversationMember.findAll({
      where: { userId: req.user.id },
      attributes: ['conversationId', 'lastReadAt', 'role'],
    });
    const conversationIds = myMemberships.map((m) => m.conversationId);
    if (!conversationIds.length) {
      return res.json([]);
    }

    const membershipByConvId = new Map(
      myMemberships.map((m) => [Number(m.conversationId), m])
    );

    const conversations = await Conversation.findAll({
      where: { id: { [Op.in]: conversationIds } },
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'role', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: ['role'] },
        },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          separate: true,
          order: [['createdAt', 'DESC']],
          include: [SENDER_WITH_PROFILE],
        },
      ],
      order: [['lastMessageAt', 'DESC']],
    });

    const sequelize = require('../config/database');
    const unreadMap = await unreadCountsByConversation(sequelize, req.user.id, conversationIds);

    const conversationsWithUnread = conversations.map((conv) => {
      const membership = membershipByConvId.get(Number(conv.id));
      const convData = conv.toJSON();
      if (Array.isArray(convData.members)) {
        convData.members = withMemberRoles(convData.members, req);
      }
      const lastRow = convData.messages && convData.messages[0];
      return {
        ...convData,
        memberships: membership
          ? [{ lastReadAt: membership.lastReadAt, role: membership.role }]
          : [],
        lastMessage: previewText(lastRow),
        unreadCount: unreadMap.get(Number(conv.id)) || 0,
      };
    });

    res.json(conversationsWithUnread);
  } catch (err) {
    console.error('Get conversations error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Get or create conversation with user
async function loadDirectConversation(conversationId, req) {
  const existingConversation = await Conversation.findByPk(conversationId, {
    include: [
      { model: ConversationMember, as: 'memberships', attributes: ['userId'] },
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'verified'],
        include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
        through: { attributes: [] },
      },
    ],
  });
  if (!existingConversation || existingConversation.isGroup) return null;
  const data = existingConversation.toJSON();
  if (Array.isArray(data.members)) {
    data.members = data.members.map((m) => shapeMemberRow(m, req));
  }
  return data;
}

exports.getOrCreateConversation = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ msg: 'Përdoruesi nuk është i vlefshëm' });
    }
    if (Number(targetUserId) === Number(req.user.id)) {
      return res.status(400).json({ msg: 'Nuk mund të hapësh bisedë me veten' });
    }

    if (await blockedWith(req.user.id, targetUserId)) {
      return res.status(403).json({ msg: 'Nuk mund të hapësh bisedë me këtë përdorues (bllokuar)' });
    }

    const targetUser = await User.findByPk(targetUserId, { attributes: ['id'] });
    if (!targetUser) {
      return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
    }

    const sequelize = require('../config/database');
    const existingRows = await sequelize.query(DIRECT_PAIR_SQL, {
      replacements: { a: req.user.id, b: targetUserId },
      type: QueryTypes.SELECT,
    });
    const existingId = conversationIdFromRow(existingRows && existingRows[0]);
    if (existingId) {
      const data = await loadDirectConversation(existingId, req);
      if (data) return res.json(data);
    }

    const t = await sequelize.transaction();
    let newConversation = null;
    try {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:pair))', {
        replacements: { pair: pairKey(req.user.id, targetUserId) },
        transaction: t,
      });
      const lockedRows = await sequelize.query(DIRECT_PAIR_SQL, {
        replacements: { a: req.user.id, b: targetUserId },
        type: QueryTypes.SELECT,
        transaction: t,
      });
      const lockedId = conversationIdFromRow(lockedRows && lockedRows[0]);
      if (lockedId) {
        await t.commit();
        const data = await loadDirectConversation(lockedId, req);
        if (data) return res.json(data);
      }

      newConversation = await Conversation.create({ isGroup: false }, { transaction: t });
      await ConversationMember.bulkCreate([
        { conversationId: newConversation.id, userId: req.user.id },
        { conversationId: newConversation.id, userId: targetUserId },
      ], { transaction: t });
      await t.commit();
      const data = await loadDirectConversation(newConversation.id, req);
      return res.json(data);
    } catch (txErr) {
      await t.rollback();
      try {
        if (newConversation?.id) {
          await Conversation.destroy({ where: { id: newConversation.id } });
        }
      } catch (cleanupErr) {
        console.error('Cleanup after failed conversation create failed:', cleanupErr.message);
      }
      throw txErr;
    }
  } catch (err) {
    console.error('Get or create conversation error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Get one conversation by id (must be a member)
exports.getConversationById = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ msg: 'Invalid conversation id' });
    }

    const membership = await ConversationMember.findOne({
      where: { conversationId, userId: req.user.id },
    });
    if (!membership) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: ConversationMember,
          as: 'memberships',
          attributes: ['userId', 'lastReadAt', 'role'],
        },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'role', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: ['role'] },
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }

    const data = conversation.toJSON();
    if (Array.isArray(data.members)) {
      data.members = withMemberRoles(data.members, req);
    }
    const mine = (data.memberships || []).find((m) => Number(m.userId) === Number(req.user.id));
    data.myRole = mine?.role || null;
    res.json(data);
  } catch (err) {
    console.error('Get conversation by id error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Verify user is member of conversation
    const access = await requireConversationMember(ConversationMember, {
      conversationId,
      userId: req.user.id,
    });
    if (!access.ok) {
      return res.status(access.status).json({ msg: access.msg });
    }

    const messages = await Message.findAndCountAll({
      where: { conversationId },
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const shaped = await attachReactions(
      messages.rows.map((m) => shapeMessage(m, req)).reverse(),
      req.user.id
    );

    const othersRead = await ConversationMember.findAll({
      where: {
        conversationId,
        userId: { [Op.ne]: req.user.id },
      },
      attributes: ['userId', 'lastReadAt'],
    });

    res.json({
      messages: shaped,
      total: messages.count,
      page,
      pages: Math.ceil(messages.count / limit) || 1,
      othersRead: othersRead.map((row) => ({
        userId: row.userId,
        lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, replyToId } = req.body;

    const access = await requireConversationMember(ConversationMember, {
      conversationId,
      userId: req.user.id,
    });
    if (!access.ok) {
      discardUpload(req.file);
      return res.status(access.status).json({ msg: access.msg });
    }

    const conversation = await Conversation.findByPk(conversationId, { attributes: ['id', 'isGroup'] });
    if (!conversation) {
      discardUpload(req.file);
      return res.status(404).json({ msg: 'Biseda nuk u gjet' });
    }

    const members = await ConversationMember.findAll({
      where: { conversationId },
      attributes: ['userId'],
    });
    if (!conversation.isGroup) {
      const other = members.map((m) => m.userId).find((id) => Number(id) !== Number(req.user.id));
      if (await blockedWith(req.user.id, other)) {
        discardUpload(req.file);
        return res.status(403).json({ msg: 'Mesazhet nuk lejohen me këtë përdorues (bllokuar)' });
      }
    }

    const textCheck = validateMessageText(content, { allowEmpty: !!req.file });
    if (!textCheck.ok) {
      discardUpload(req.file);
      return res.status(textCheck.status).json({ msg: textCheck.msg });
    }

    let messageData = {
      conversationId,
      senderId: req.user.id,
      content: textCheck.text.trim() ? textCheck.text : '',
      type: 'text',
    };

    if (replyToId) {
      const parent = await Message.findOne({
        where: { id: replyToId, conversationId },
        attributes: ['id', 'deleted'],
      });
      if (!parent || parent.deleted) {
        discardUpload(req.file);
        return res.status(400).json({ msg: 'Mesazhi origjinal nuk është i disponueshëm' });
      }
      messageData.replyToId = parent.id;
    }

    if (req.file) {
      const inspected = inspectUploadedFile(req.file);
      if (!inspected.ok) {
        discardUpload(req.file);
        return res.status(400).json({ msg: inspected.msg });
      }
      messageData.fileUrl = `/uploads/messages/${req.file.filename}`;
      messageData.fileName = safeDisplayFileName(req.file.originalname);
      messageData.type = inspected.type;
    }

    const recipients = members.filter((m) => Number(m.userId) !== Number(req.user.id));
    const someoneOnline = recipients.some((m) => isUserOnline(m.userId));
    if (someoneOnline) messageData.deliveredAt = new Date();

    const message = await Message.create(messageData);
    await Conversation.update(
      { lastMessageAt: new Date() },
      { where: { id: conversationId } }
    );

    const fullMessage = await Message.findByPk(message.id, {
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
    });
    const payload = shapeMessage(fullMessage, req);
    payload.reactions = [];

    const recipientIds = recipients.map((m) => m.userId);
    emitConversation('newMessage', conversationId, payload, [req.user.id, ...recipientIds]);
    if (payload.deliveredAt) {
      emitConversation('messageDelivered', conversationId, {
        conversationId: Number(conversationId),
        messageId: payload.id,
        deliveredAt: new Date(payload.deliveredAt).toISOString(),
      }, [req.user.id, ...recipientIds]);
    }

    const sender = await User.findByPk(req.user.id, { attributes: ['firstName', 'lastName'] });
    const senderName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'Mesazh i ri';
    const previewBase = (messageData.content || messageData.fileName || 'Media').trim();
    const preview = previewBase.length > 100 ? `${previewBase.slice(0, 100)}…` : previewBase;
    let io = null;
    try {
      io = require('../socket').getIo();
    } catch (_err) {
      io = null;
    }

    for (const member of recipients) {
      if (userIsViewingConversation(io, member.userId, conversationId)) continue;
      try {
        const recipient = await User.findByPk(member.userId, { attributes: ['id', 'email'] });
        if (recipient?.email) {
          await sendEmail(recipient.email, 'newMessage', senderName, preview, conversationId);
        }
      } catch (emailError) {
        console.error('Email notification failed:', emailError.message);
      }
      try {
        await sendNotification(member.userId, senderName, preview, {
          type: 'message',
          conversationId: Number(conversationId),
          link: `/messaging?conversationId=${conversationId}`,
        });
      } catch (pushError) {
        console.error('Push notification failed:', pushError.message);
      }
    }

    res.json(payload);
  } catch (err) {
    discardUpload(req.file);
    console.error('Send message error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await requireConversationMember(ConversationMember, {
      conversationId,
      userId: req.user.id,
    });
    if (!access.ok) {
      return res.status(access.status).json({ msg: access.msg });
    }

    const readAt = new Date();
    await ConversationMember.update(
      { lastReadAt: readAt },
      { where: { conversationId, userId: req.user.id } }
    );

    await Message.update(
      { isRead: true },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: req.user.id },
          deleted: false,
          createdAt: { [Op.lte]: readAt },
        },
      }
    );

    const memberIds = await ConversationMember.findAll({
      where: { conversationId },
      attributes: ['userId'],
    });
    const payload = {
      conversationId: Number(conversationId) || conversationId,
      userId: req.user.id,
      readAt: readAt.toISOString(),
    };
    emitConversation('conversationRead', conversationId, payload, memberIds.map((m) => m.userId));
    emitConversation('messageRead', conversationId, payload, memberIds.map((m) => m.userId));

    res.json({ msg: 'Marked as read', readAt: readAt.toISOString() });
  } catch (err) {
    console.error('Mark as read error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Create group conversation
exports.createGroup = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const rawIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    if (!name || name.length > 80) {
      return res.status(400).json({ msg: 'Shkruaj një emër grupi (maksimumi 80 karaktere)' });
    }
    const memberIds = [...new Set(
      rawIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0 && id !== Number(req.user.id))
    )];
    if (memberIds.length < 2) {
      return res.status(400).json({ msg: 'Duhen të paktën 2 anëtarë të tjerë' });
    }

    const users = await User.findAll({ where: { id: { [Op.in]: memberIds } }, attributes: ['id'] });
    const validIds = users.map((u) => Number(u.id));
    if (validIds.length < 2) {
      return res.status(400).json({ msg: 'Duhen të paktën 2 anëtarë të vlefshëm' });
    }
    for (const id of validIds) {
      if (await blockedWith(req.user.id, id)) {
        return res.status(403).json({ msg: 'Nuk mund të krijosh grup me një përdorues të bllokuar' });
      }
    }

    const conversation = await Conversation.create({
      isGroup: true,
      name,
      ownerId: req.user.id,
    });

    await ConversationMember.create({
      conversationId: conversation.id,
      userId: req.user.id,
      role: 'admin',
    });

    await ConversationMember.bulkCreate(
      validIds.map((userId) => ({
        conversationId: conversation.id,
        userId,
        role: 'member',
      }))
    );

    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'verified'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: ['role'] },
        },
      ],
    });

    const data = fullConversation.toJSON();
    if (Array.isArray(data.members)) {
      data.members = withMemberRoles(data.members, req);
    }
    data.memberships = [{ lastReadAt: null, role: 'admin', userId: req.user.id }];
    data.myRole = 'admin';
    const memberUserIds = (data.members || []).map((m) => m.id);
    emitConversation('conversationUpdated', conversation.id, data, memberUserIds);
    res.json(data);
  } catch (err) {
    console.error('Create group error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

async function fetchGroupConversationPayload(conversationId, req) {
  const fullConversation = await Conversation.findByPk(conversationId, {
    include: [
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'role', 'verified'],
        include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
        through: { attributes: ['role'] },
      },
    ],
  });
  if (!fullConversation) return null;
  const data = fullConversation.toJSON();
  if (Array.isArray(data.members)) {
    data.members = withMemberRoles(data.members, req);
  }
  const mine = (data.members || []).find((m) => Number(m.id) === Number(req?.user?.id));
  data.myRole = mine?.memberRole || null;
  if (data.avatar) data.avatar = toAbsoluteUploadsUrl(req, data.avatar);
  return data;
}

/** Invite / add members to an existing group (any current member). */
exports.addGroupMembers = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const rawIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ msg: 'Invalid conversation id' });
    }
    const memberIds = [
      ...new Set(
        rawIds
          .map((id) => parseInt(id, 10))
          .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(req.user.id))
      ),
    ];
    if (!memberIds.length) {
      return res.status(400).json({ msg: 'Zgjidh të paktën një anëtar për të ftuar' });
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ msg: 'Grupi nuk u gjet' });
    }

    const myMembership = await ConversationMember.findOne({
      where: { conversationId, userId: req.user.id },
    });
    if (!myMembership) {
      return res.status(403).json({ msg: 'Nuk je anëtar i këtij grupi' });
    }

    const existing = await ConversationMember.findAll({
      where: { conversationId, userId: { [Op.in]: memberIds } },
      attributes: ['userId'],
    });
    const existingSet = new Set(existing.map((row) => Number(row.userId)));
    const toAdd = memberIds.filter((id) => !existingSet.has(id));
    if (!toAdd.length) {
      const data = await fetchGroupConversationPayload(conversationId, req);
      return res.json(data);
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: toAdd } },
      attributes: ['id'],
    });
    const validIds = [];
    for (const user of users) {
      const id = Number(user.id);
      if (await blockedWith(req.user.id, id)) continue;
      validIds.push(id);
    }
    if (!validIds.length) {
      return res.status(400).json({ msg: 'Nuk u gjetën përdorues për ftesë' });
    }

    await ConversationMember.bulkCreate(
      validIds.map((userId) => ({
        conversationId,
        userId,
        role: 'member',
      }))
    );

    const data = await fetchGroupConversationPayload(conversationId, req);
    const memberUserIds = (data?.members || []).map((m) => m.id);
    emitConversation('conversationUpdated', conversationId, data, memberUserIds);
    res.json(data);
  } catch (err) {
    console.error('Add group members error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

/** Leave a group conversation. */
exports.leaveGroup = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ msg: 'Invalid conversation id' });
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ msg: 'Grupi nuk u gjet' });
    }

    const myMembership = await ConversationMember.findOne({
      where: { conversationId, userId: req.user.id },
    });
    if (!myMembership) {
      return res.status(403).json({ msg: 'Nuk je anëtar i këtij grupi' });
    }

    const remaining = await ConversationMember.findAll({
      where: {
        conversationId,
        userId: { [Op.ne]: req.user.id },
      },
      order: [['joinedAt', 'ASC']],
    });

    const leavingIsOwner = conversation.ownerId != null && Number(conversation.ownerId) === Number(req.user.id);
    if ((myMembership.role === 'admin' || leavingIsOwner) && remaining.length > 0) {
      const hasOtherAdmin = remaining.some((m) => m.role === 'admin' && Number(m.userId) !== Number(req.user.id));
      if (!hasOtherAdmin) {
        await remaining[0].update({ role: 'admin' });
      }
      if (leavingIsOwner) {
        const nextOwner = remaining.find((m) => m.role === 'admin') || remaining[0];
        await conversation.update({ ownerId: nextOwner.userId });
      }
    }

    await myMembership.destroy();

    if (remaining.length === 0) {
      await Message.destroy({ where: { conversationId } });
      await conversation.destroy();
      return res.json({ left: true, deleted: true, conversationId });
    }

    res.json({ left: true, deleted: false, conversationId });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

async function loadOwnedMessage(messageId, userId) {
  const message = await Message.findOne({
    where: { id: messageId, senderId: userId },
  });
  if (!message) return { error: { status: 404, msg: 'Mesazhi nuk u gjet' } };
  const access = await requireConversationMember(ConversationMember, {
    conversationId: message.conversationId,
    userId,
  });
  if (!access.ok) return { error: access };
  if (message.deleted) return { error: { status: 400, msg: 'Mesazhi i fshirë nuk mund të ndryshohet' } };
  return { message };
}

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const owned = await loadOwnedMessage(req.params.messageId, req.user.id);
    if (owned.error) return res.status(owned.error.status).json({ msg: owned.error.msg });
    if (owned.message.type !== 'text' || owned.message.fileUrl) {
      return res.status(400).json({ msg: 'Vetëm mesazhet me tekst mund të ndryshohen' });
    }
    const textCheck = validateMessageText(req.body?.content, { allowEmpty: false });
    if (!textCheck.ok) return res.status(textCheck.status).json({ msg: textCheck.msg });

    await owned.message.update({ content: textCheck.text, edited: true });
    await owned.message.reload({ include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER] });
    const payload = shapeMessage(owned.message, req);
    const [withReactions] = await attachReactions([payload], req.user.id);
    const memberIds = await ConversationMember.findAll({
      where: { conversationId: payload.conversationId },
      attributes: ['userId'],
    });
    emitConversation('messageUpdated', payload.conversationId, {
      conversationId: payload.conversationId,
      message: withReactions,
    }, memberIds.map((m) => m.userId));
    res.json(withReactions);
  } catch (err) {
    console.error('Edit message error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Delete message (soft delete for everyone; sender only)
exports.deleteMessage = async (req, res) => {
  try {
    const owned = await loadOwnedMessage(req.params.messageId, req.user.id);
    if (owned.error) return res.status(owned.error.status).json({ msg: owned.error.msg });

    const convId = owned.message.conversationId;
    await owned.message.update({ deleted: true, content: '' });
    const memberIds = await ConversationMember.findAll({
      where: { conversationId: convId },
      attributes: ['userId'],
    });
    emitConversation('messageDeleted', convId, {
      conversationId: convId,
      messageId: owned.message.id,
    }, memberIds.map((m) => m.userId));
    res.json({ msg: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await requireConversationMember(ConversationMember, {
      conversationId,
      userId: req.user.id,
    });
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });

    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ msg: 'Shkruaj një kërkim' });
    if (q.length > 120) return res.status(400).json({ msg: 'Kërkimi është shumë i gjatë' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const pattern = `%${escapeLike(q)}%`;
    const messages = await Message.findAndCountAll({
      where: {
        conversationId,
        deleted: false,
        [Op.or]: [
          { content: { [Op.iLike]: pattern } },
          { fileName: { [Op.iLike]: pattern } },
        ],
      },
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const shaped = await attachReactions(
      messages.rows.map((m) => shapeMessage(m, req)),
      req.user.id
    );
    res.json({
      messages: shaped,
      total: messages.count,
      page,
      pages: Math.ceil(messages.count / limit) || 1,
    });
  } catch (err) {
    console.error('Search messages error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.toggleReaction = async (req, res) => {
  try {
    const emoji = normalizeReactionEmoji(req.body?.emoji);
    if (!emoji) return res.status(400).json({ msg: 'Reagimi nuk lejohet' });

    const message = await Message.findByPk(req.params.messageId);
    if (!message || message.deleted) {
      return res.status(404).json({ msg: 'Mesazhi nuk u gjet' });
    }
    const access = await requireConversationMember(ConversationMember, {
      conversationId: message.conversationId,
      userId: req.user.id,
    });
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });

    const existing = await MessageReaction.findOne({
      where: { messageId: message.id, userId: req.user.id, emoji },
    });
    if (reactionToggleDecision(existing) === 'remove') {
      await existing.destroy();
    } else {
      try {
        await MessageReaction.create({ messageId: message.id, userId: req.user.id, emoji });
      } catch (createErr) {
        if (createErr?.name !== 'SequelizeUniqueConstraintError') throw createErr;
      }
    }

    const rows = await MessageReaction.findAll({
      where: { messageId: message.id },
      attributes: ['messageId', 'userId', 'emoji'],
    });
    const reactions = summarizeReactions(rows, req.user.id);
    const memberIds = await ConversationMember.findAll({
      where: { conversationId: message.conversationId },
      attributes: ['userId'],
    });
    const payload = {
      conversationId: message.conversationId,
      messageId: message.id,
      reactions,
    };
    emitConversation('messageReactionUpdated', message.conversationId, payload, memberIds.map((m) => m.userId));
    res.json(payload);
  } catch (err) {
    console.error('Toggle reaction error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.forwardMessage = async (req, res) => {
  try {
    const targetConversationId = parseInt(req.body?.conversationId, 10);
    if (!Number.isFinite(targetConversationId)) {
      return res.status(400).json({ msg: 'Biseda e destinacionit mungon' });
    }
    const source = await Message.findByPk(req.params.messageId);
    if (!source || source.deleted) return res.status(404).json({ msg: 'Mesazhi nuk u gjet' });

    const sourceAccess = await requireConversationMember(ConversationMember, {
      conversationId: source.conversationId,
      userId: req.user.id,
    });
    if (!sourceAccess.ok) return res.status(sourceAccess.status).json({ msg: sourceAccess.msg });
    const targetAccess = await requireConversationMember(ConversationMember, {
      conversationId: targetConversationId,
      userId: req.user.id,
    });
    if (!targetAccess.ok) return res.status(targetAccess.status).json({ msg: targetAccess.msg });

    const targetConversation = await Conversation.findByPk(targetConversationId, { attributes: ['id', 'isGroup'] });
    if (!targetConversation) return res.status(404).json({ msg: 'Biseda nuk u gjet' });
    if (!targetConversation.isGroup) {
      const members = await ConversationMember.findAll({
        where: { conversationId: targetConversationId },
        attributes: ['userId'],
      });
      const other = members.map((m) => m.userId).find((id) => Number(id) !== Number(req.user.id));
      if (await blockedWith(req.user.id, other)) {
        return res.status(403).json({ msg: 'Mesazhet nuk lejohen me këtë përdorues (bllokuar)' });
      }
    }

    const textCheck = validateMessageText(source.content || '', { allowEmpty: !!source.fileUrl });
    if (!textCheck.ok) return res.status(textCheck.status).json({ msg: textCheck.msg });

    const copy = await Message.create({
      conversationId: targetConversationId,
      senderId: req.user.id,
      content: textCheck.text.trim() ? textCheck.text : '',
      type: source.type || 'text',
      fileUrl: source.fileUrl,
      fileName: source.fileName,
      forwarded: true,
    });
    await Conversation.update({ lastMessageAt: new Date() }, { where: { id: targetConversationId } });
    const fullMessage = await Message.findByPk(copy.id, { include: [SENDER_WITH_PROFILE] });
    const payload = shapeMessage(fullMessage, req);
    payload.reactions = [];
    const members = await ConversationMember.findAll({
      where: { conversationId: targetConversationId },
      attributes: ['userId'],
    });
    emitConversation('newMessage', targetConversationId, payload, members.map((m) => m.userId));
    res.status(201).json(payload);
  } catch (err) {
    console.error('Forward message error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

async function loadManagedGroup(conversationId, userId, action, targetId = null) {
  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation || !conversation.isGroup) {
    return { error: { status: 404, msg: 'Grupi nuk u gjet' } };
  }
  const actor = await ConversationMember.findOne({ where: { conversationId, userId } });
  let target = null;
  if (targetId != null) {
    target = await ConversationMember.findOne({ where: { conversationId, userId: targetId } });
  }
  const adminCount = await ConversationMember.count({ where: { conversationId, role: 'admin' } });
  const gate = authorizeGroupAction({
    action,
    actorId: userId,
    actorRole: actor?.role || null,
    targetId,
    targetRole: target?.role || null,
    ownerId: conversation.ownerId,
    isGroup: true,
    adminCount,
  });
  if (!gate.ok) return { error: gate };
  return { conversation, actor, target };
}

exports.updateGroup = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const loaded = await loadManagedGroup(conversationId, req.user.id, 'rename');
    if (loaded.error) return res.status(loaded.error.status).json({ msg: loaded.error.msg });
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 80) {
      return res.status(400).json({ msg: 'Shkruaj një emër grupi (maksimumi 80 karaktere)' });
    }
    await loaded.conversation.update({ name });
    const data = await fetchGroupConversationPayload(conversationId, req);
    emitConversation('conversationUpdated', conversationId, data, (data?.members || []).map((m) => m.id));
    res.json(data);
  } catch (err) {
    console.error('Update group error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.updateGroupAvatar = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const loaded = await loadManagedGroup(conversationId, req.user.id, 'avatar');
    if (loaded.error) {
      discardUpload(req.file);
      return res.status(loaded.error.status).json({ msg: loaded.error.msg });
    }
    if (!req.file) return res.status(400).json({ msg: 'Zgjidh një foto' });
    const inspected = inspectUploadedFile(req.file);
    if (!inspected.ok || inspected.type !== 'image') {
      discardUpload(req.file);
      return res.status(400).json({ msg: inspected.ok ? 'Avatari duhet të jetë foto' : inspected.msg });
    }
    await loaded.conversation.update({ avatar: `/uploads/messages/${req.file.filename}` });
    const data = await fetchGroupConversationPayload(conversationId, req);
    if (data?.avatar) data.avatar = toAbsoluteUploadsUrl(req, data.avatar);
    emitConversation('conversationUpdated', conversationId, data, (data?.members || []).map((m) => m.id));
    res.json(data);
  } catch (err) {
    discardUpload(req.file);
    console.error('Update group avatar error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const targetId = parseInt(req.params.userId, 10);
    const loaded = await loadManagedGroup(conversationId, req.user.id, 'remove', targetId);
    if (loaded.error) return res.status(loaded.error.status).json({ msg: loaded.error.msg });
    await loaded.target.destroy();
    const data = await fetchGroupConversationPayload(conversationId, req);
    emitConversation('conversationUpdated', conversationId, { ...data, removedUserId: targetId }, [
      targetId,
      ...(data?.members || []).map((m) => m.id),
    ]);
    res.json(data);
  } catch (err) {
    console.error('Remove group member error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.setGroupMemberRole = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const targetId = parseInt(req.params.userId, 10);
    const role = String(req.body?.role || '');
    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ msg: 'Roli nuk është i vlefshëm' });
    }
    const action = role === 'admin' ? 'promote' : 'demote';
    const loaded = await loadManagedGroup(conversationId, req.user.id, action, targetId);
    if (loaded.error) return res.status(loaded.error.status).json({ msg: loaded.error.msg });
    await loaded.target.update({ role });
    const data = await fetchGroupConversationPayload(conversationId, req);
    emitConversation('conversationUpdated', conversationId, data, (data?.members || []).map((m) => m.id));
    res.json(data);
  } catch (err) {
    console.error('Set group role error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.transferGroupOwnership = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const targetId = parseInt(req.body?.userId, 10);
    const loaded = await loadManagedGroup(conversationId, req.user.id, 'transfer', targetId);
    if (loaded.error) return res.status(loaded.error.status).json({ msg: loaded.error.msg });
    await loaded.conversation.update({ ownerId: targetId });
    if (loaded.target.role !== 'admin') await loaded.target.update({ role: 'admin' });
    const data = await fetchGroupConversationPayload(conversationId, req);
    emitConversation('conversationUpdated', conversationId, data, (data?.members || []).map((m) => m.id));
    res.json(data);
  } catch (err) {
    console.error('Transfer ownership error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.ackDelivered = async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Mesazhi nuk u gjet' });
    const access = await requireConversationMember(ConversationMember, {
      conversationId: message.conversationId,
      userId: req.user.id,
    });
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });
    if (Number(message.senderId) === Number(req.user.id)) {
      return res.json({ deliveredAt: message.deliveredAt });
    }
    if (!message.deliveredAt) {
      message.deliveredAt = new Date();
      await message.save();
    }
    const memberIds = await ConversationMember.findAll({
      where: { conversationId: message.conversationId },
      attributes: ['userId'],
    });
    const payload = {
      conversationId: message.conversationId,
      messageId: message.id,
      deliveredAt: message.deliveredAt.toISOString(),
    };
    emitConversation('messageDelivered', message.conversationId, payload, memberIds.map((m) => m.userId));
    res.json(payload);
  } catch (err) {
    console.error('Ack delivered error:', err.message);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};