const Message = require('../models/Message');
const { Conversation, ConversationMember } = require('../models/Conversation');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { notifyMessage } = require('./notificationsController');
const { sendEmail } = require('../services/emailService');
const { Op, QueryTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');

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
          through: { attributes: [] },
        },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName'],
            },
          ],
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
            createdAt: {
              [Op.gt]: membership.lastReadAt || new Date(0),
            },
          },
        });

        const convData = conv.toJSON();
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
    res.status(500).json({ msg: 'Server error', error: err.message });
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
          { model: User, as: 'members', attributes: ['id', 'firstName', 'lastName'], through: { attributes: [] } },
        ],
      });
      if (existingConversation && !existingConversation.isGroup) {
        return res.json(existingConversation);
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
          { model: User, as: 'members', attributes: ['id', 'firstName', 'lastName'], through: { attributes: [] } },
        ],
      });

      return res.json(fullConversation);
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
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verify user is member of conversation
    const membership = await ConversationMember.findOne({
      where: {
        conversationId,
        userId: req.user.id,
      },
    });

    if (!membership) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const messages = await Message.findAndCountAll({
      where: {
        conversationId,
        deleted: false,
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
        },
        {
          model: Message,
          as: 'replyTo',
          attributes: ['id', 'content', 'senderId'],
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['firstName', 'lastName'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      messages: messages.rows.reverse(), // Show oldest first
      total: messages.count,
      page: parseInt(page),
      pages: Math.ceil(messages.count / limit),
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    console.log('🔵 sendMessage called for conversation:', req.params.conversationId);
    const { conversationId } = req.params;
    const { content, replyToId } = req.body;

    // Verify user is member of conversation
    const membership = await ConversationMember.findOne({
      where: {
        conversationId,
        userId: req.user.id,
      },
    });

    if (!membership) {
      return res.status(403).json({ msg: 'Not authorized' });
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

    // Get full message with sender info (removed profilePhoto as it's in Profile model)
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
        },
        {
          model: Message,
          as: 'replyTo',
          attributes: ['id', 'content', 'senderId'],
        },
      ],
    });

    // Send notifications to other members
    const members = await ConversationMember.findAll({
      where: {
        conversationId,
        userId: { [Op.ne]: req.user.id },
      },
    });

    const conversation = await Conversation.findByPk(conversationId);
    const sender = await User.findByPk(req.user.id);
    const senderName = `${sender.firstName} ${sender.lastName}`;
    
    for (const member of members) {
      await notifyMessage(member.userId, req.user.id, fullMessage);
      
      // Send email notification
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

    console.log('✅ Message sent successfully');
    res.json(fullMessage);
  } catch (err) {
    console.error('❌ Send message error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await ConversationMember.update(
      { lastReadAt: new Date() },
      {
        where: {
          conversationId,
          userId: req.user.id,
        },
      }
    );

    res.json({ msg: 'Marked as read' });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ msg: 'Server error' });
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
          attributes: ['id', 'firstName', 'lastName', 'profilePhoto'],
          through: { attributes: ['role'] },
        },
      ],
    });

    res.json(fullConversation);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ msg: 'Server error' });
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

    res.json(message);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ msg: 'Server error' });
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

    await message.update({ deleted: true });

    res.json({ msg: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};