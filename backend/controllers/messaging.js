const Message = require('../models/Message');
const { Conversation, ConversationMember } = require('../models/Conversation');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { sendEmail } = require('../services/emailService');
const { Op, QueryTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const { toAbsoluteUploadsUrl } = require('../utils/url');
const { requireConversationMember } = require('../utils/conversationAcl');

/** Sender + Profile për avatar në chat */
const SENDER_WITH_PROFILE = {
  model: User,
  as: 'sender',
  attributes: ['id', 'firstName', 'lastName'],
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
      attributes: ['firstName', 'lastName'],
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
  if (plain.replyTo) {
    const r = { ...plain.replyTo };
    if (r.sender) r.sender = shapeSender(r.sender, req);
    if (r.fileUrl) r.fileUrl = toAbsoluteUploadsUrl(req, r.fileUrl);
    plain.replyTo = r;
  }
  if (plain.fileUrl) plain.fileUrl = toAbsoluteUploadsUrl(req, plain.fileUrl);
  return plain;
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
    console.log('🔵 getConversations called for user:', req.user.id);
    
    const conversations = await Conversation.findAll({
      include: [
        {
          model: ConversationMember,
          as: 'memberships',
          where: { userId: req.user.id },
          attributes: ['lastReadAt', 'role'],
        },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: [] },
        },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [SENDER_WITH_PROFILE],
        },
      ],
      order: [['lastMessageAt', 'DESC']],
    });

    console.log('🔵 Found conversations:', conversations.length);

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const membership = conv.memberships[0];
        const unreadCount = await Message.count({
          where: {
            conversationId: conv.id,
            senderId: { [Op.ne]: req.user.id },
            deleted: false,
            createdAt: {
              [Op.gt]: membership.lastReadAt || new Date(0),
            },
          },
        });

        const convData = conv.toJSON();
        if (Array.isArray(convData.members)) {
          convData.members = convData.members.map((m) => shapeMemberRow(m, req));
        }
        const lastMessage = convData.messages && convData.messages[0]
          ? convData.messages[0].content
          : null;

        return {
          ...convData,
          lastMessage,
          unreadCount,
        };
      })
    );

    console.log('✅ Sending conversations:', conversationsWithUnread.length);
    res.json(conversationsWithUnread);
  } catch (err) {
    console.error('❌ Get conversations error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};

// Get or create conversation with user
exports.getOrCreateConversation = async (req, res) => {
  try {
    console.log('🔵 getOrCreateConversation called');
    console.log('🔵 req.user:', req.user);
    console.log('🔵 req.params.userId:', req.params.userId);
    
    const { userId } = req.params;
    const targetUserId = parseInt(userId);
    
    console.log('🔵 Current user ID:', req.user.id);
    console.log('🔵 Target user ID:', targetUserId);
    
    // Verify target user exists
    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      console.log('❌ Target user not found:', targetUserId);
      return res.status(404).json({ msg: 'User not found' });
    }
    console.log('✅ Target user exists:', targetUser.firstName, targetUser.lastName);
    
    // Find conversation where both users are members (efficient, avoids loading all conversations)
    const sequelize = require('../config/database');
    // Use a raw, parameterized SQL query to avoid Sequelize HAVING/name-qualification issues
    const sql = `SELECT "conversationId" FROM "ConversationMembers" WHERE "userId" IN (:a,:b) GROUP BY "conversationId" HAVING COUNT("userId") = 2 LIMIT 1`;
    const convoMatches = await sequelize.query(sql, {
      replacements: { a: req.user.id, b: targetUserId },
      type: QueryTypes.SELECT,
    });

    if (convoMatches && convoMatches.length > 0) {
      const conversationId = convoMatches[0].conversationId || convoMatches[0].conversationid || convoMatches[0].conversation_id;
      const existingConversation = await Conversation.findByPk(conversationId, {
        include: [
          { model: ConversationMember, as: 'memberships', attributes: ['userId'] },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
            through: { attributes: [] },
          },
        ],
      });
      if (existingConversation && !existingConversation.isGroup) {
        const data = existingConversation.toJSON();
        if (Array.isArray(data.members)) {
          data.members = data.members.map((m) => shapeMemberRow(m, req));
        }
        return res.json(data);
      }
    }

    // Create new conversation inside a transaction to avoid race conditions
    let newConversation = null;
    const t = await sequelize.transaction();
    try {
      newConversation = await Conversation.create({ isGroup: false }, { transaction: t });

      await ConversationMember.bulkCreate([
        { conversationId: newConversation.id, userId: req.user.id },
        { conversationId: newConversation.id, userId: targetUserId },
      ], { transaction: t });

      await t.commit();

      const fullConversation = await Conversation.findByPk(newConversation.id, {
        include: [
          { model: ConversationMember, as: 'memberships', attributes: ['userId'] },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
            through: { attributes: [] },
          },
        ],
      });

      const data = fullConversation.toJSON();
      if (Array.isArray(data.members)) {
        data.members = data.members.map((m) => shapeMemberRow(m, req));
      }
      return res.json(data);
    } catch (txErr) {
      await t.rollback();
      // cleanup if partially created
      try {
        if (newConversation && newConversation.id) {
          await Conversation.destroy({ where: { id: newConversation.id } });
        }
      } catch (cleanupErr) {
        console.error('Cleanup after failed conversation create failed:', cleanupErr);
      }
      throw txErr;
    }
  } catch (err) {
    console.error('Get or create conversation error:', err);
    console.error(err.stack);
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
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
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: [] },
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }

    const data = conversation.toJSON();
    if (Array.isArray(data.members)) {
      data.members = data.members.map((m) => shapeMemberRow(m, req));
    }
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
    const { page = 1, limit = 50 } = req.query;
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
      where: {
        conversationId,
        deleted: false,
      },
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const shaped = messages.rows.map((m) => shapeMessage(m, req)).reverse();

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
      page: parseInt(page),
      pages: Math.ceil(messages.count / limit),
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
    console.log('🔵 sendMessage called for conversation:', req.params.conversationId);
    const { conversationId } = req.params;
    const { content, replyToId } = req.body;

    // Verify user is member of conversation
    const access = await requireConversationMember(ConversationMember, {
      conversationId,
      userId: req.user.id,
    });
    if (!access.ok) {
      return res.status(access.status).json({ msg: access.msg });
    }

    let messageData = {
      conversationId,
      senderId: req.user.id,
      content: content || '',
      type: 'text',
    };

    if (replyToId) {
      messageData.replyToId = replyToId;
    }

    // Handle file upload
    if (req.file) {
      messageData.fileUrl = '/uploads/messages/' + req.file.filename;
      messageData.fileName = req.file.originalname;
      
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        messageData.type = 'image';
      } else if (['mp4', 'mov', 'avi'].includes(ext)) {
        messageData.type = 'video';
      } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
        messageData.type = 'audio';
      } else {
        messageData.type = 'file';
      }
    }

    const message = await Message.create(messageData);
    console.log('✅ Message created:', message.id);

    // Update conversation last message time
    await Conversation.update(
      { lastMessageAt: new Date() },
      { where: { id: conversationId } }
    );

    const fullMessage = await Message.findByPk(message.id, {
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
    });

    const payload = shapeMessage(fullMessage, req);

    // Send notifications to other members
    const members = await ConversationMember.findAll({
      where: {
        conversationId,
        userId: { [Op.ne]: req.user.id },
      },
    });

    const sender = await User.findByPk(req.user.id);
    const senderName = `${sender.firstName} ${sender.lastName}`;
    
    for (const member of members) {
      try {
        const recipient = await User.findByPk(member.userId);
        const safeContent = typeof content === 'string' ? content : '';
        const previewBase = safeContent || messageData.fileName || 'Media message';
        const preview = previewBase.substring(0, 100) + (previewBase.length > 100 ? '...' : '');
        await sendEmail(recipient.email, 'newMessage', senderName, preview, conversationId);
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }
    }

    // Socket: biseda + dhoma e userId (klientët join me `emit('join', userId)`), që badge-i i Chats të rifreskohet edhe jashtë ekranit të bisedës.
    try {
      const socketHelper = require('../socket');
      const io = socketHelper.getIo();
      if (io) {
        io.to(`conversation-${conversationId}`).emit('newMessage', payload);
        if (req.user?.id != null) {
          io.to(String(req.user.id)).emit('newMessage', payload);
        }
        members.forEach((m) => {
          if (m.userId != null) {
            io.to(String(m.userId)).emit('newMessage', payload);
          }
        });
      }
    } catch (emitErr) {
      console.warn('Emit newMessage failed in messaging controller', emitErr && emitErr.message);
    }

    console.log('✅ Message sent successfully');
    res.json(payload);
  } catch (err) {
    console.error('❌ Send message error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const readAt = new Date();
    await ConversationMember.update(
      { lastReadAt: readAt },
      {
        where: {
          conversationId,
          userId: req.user.id,
        },
      }
    );

    try {
      const socketHelper = require('../socket');
      const io = socketHelper.getIo();
      if (io) {
        const payload = {
          conversationId: Number(conversationId) || conversationId,
          userId: req.user.id,
          readAt: readAt.toISOString(),
        };
        io.to(`conversation-${conversationId}`).emit('conversationRead', payload);
        io.to(String(req.user.id)).emit('conversationRead', payload);
      }
    } catch (emitErr) {
      console.warn('Emit conversationRead failed', emitErr && emitErr.message);
    }

    res.json({ msg: 'Marked as read', readAt: readAt.toISOString() });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Create group conversation
exports.createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;

    if (!memberIds || memberIds.length < 2) {
      return res.status(400).json({ msg: 'At least 2 members required' });
    }

    const conversation = await Conversation.create({
      isGroup: true,
      name,
    });

    // Add creator as admin
    await ConversationMember.create({
      conversationId: conversation.id,
      userId: req.user.id,
      role: 'admin',
    });

    // Add other members
    await ConversationMember.bulkCreate(
      memberIds.map(userId => ({
        conversationId: conversation.id,
        userId: parseInt(userId),
        role: 'member',
      }))
    );

    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'], required: false }],
          through: { attributes: ['role'] },
        },
      ],
    });

    const data = fullConversation.toJSON();
    if (Array.isArray(data.members)) {
      data.members = data.members.map((m) => shapeMemberRow(m, req));
    }
    res.json(data);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findOne({
      where: {
        id: messageId,
        senderId: req.user.id,
      },
    });

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    await message.update({
      content,
      edited: true,
    });

    await message.reload({
      include: [SENDER_WITH_PROFILE, REPLY_TO_WITH_SENDER],
    });

    const payload = shapeMessage(message, req);
    try {
      const socketHelper = require('../socket');
      const io = socketHelper.getIo();
      if (io && payload.conversationId) {
        io.to(`conversation-${payload.conversationId}`).emit('messageUpdated', {
          conversationId: payload.conversationId,
          message: payload,
        });
      }
    } catch (emitErr) {
      console.warn('Emit messageUpdated failed', emitErr && emitErr.message);
    }

    res.json(payload);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({
      where: {
        id: messageId,
        senderId: req.user.id,
      },
    });

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    const convId = message.conversationId;
    await message.update({ deleted: true });

    try {
      const socketHelper = require('../socket');
      const io = socketHelper.getIo();
      if (io && convId) {
        io.to(`conversation-${convId}`).emit('messageDeleted', {
          conversationId: convId,
          messageId: message.id,
        });
      }
    } catch (emitErr) {
      console.warn('Emit messageDeleted failed', emitErr && emitErr.message);
    }

    res.json({ msg: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};