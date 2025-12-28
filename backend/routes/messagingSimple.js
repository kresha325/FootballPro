const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// GET /api/messaging/conversations - Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all unique conversations (users who have exchanged messages)
    const [conversations] = await sequelize.query(`
      SELECT DISTINCT
        CASE 
          WHEN m."senderId" = :userId THEN m."receiverId"
          ELSE m."senderId"
        END as "otherUserId",
        MAX(m."createdAt") as "lastMessageAt"
      FROM "Messages" m
      WHERE m."senderId" = :userId OR m."receiverId" = :userId
      GROUP BY "otherUserId"
      ORDER BY "lastMessageAt" DESC
    `, {
      replacements: { userId: currentUserId }
    });

    // Get user details and last message for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await User.findByPk(conv.otherUserId, {
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto']
          }]
        });

        // Get last message
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { senderId: currentUserId, receiverId: conv.otherUserId },
              { senderId: conv.otherUserId, receiverId: currentUserId }
            ]
          },
          order: [['createdAt', 'DESC']],
          include: [{
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName']
          }]
        });

        // Count unread messages
        const unreadCount = await Message.count({
          where: {
            senderId: conv.otherUserId,
            receiverId: currentUserId,
            // You can add a 'read' field to Message model for better tracking
          }
        });

        return {
          id: conv.otherUserId, // Using userId as conversation ID for simplicity
          otherUser: {
            id: otherUser.id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            profilePhoto: otherUser.Profile?.profilePhoto
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender
          } : null,
          unreadCount,
          lastMessageAt: conv.lastMessageAt
        };
      })
    );

    res.json(conversationsWithDetails);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// GET /api/messaging/conversations/:conversationId/messages - Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;
    const otherUserId = parseInt(conversationId); // Using userId as conversationId

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto']
          }]
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/messaging/conversations/:conversationId/messages - Send message in a conversation
router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user.id;
    const otherUserId = parseInt(conversationId); // Using userId as conversationId

    if (!content || !content.trim()) {
      return res.status(400).json({ msg: 'Message content is required' });
    }

    // Check if users follow each other (mutual follow required)
    const isFollowing = await Follow.findOne({
      where: {
        followerId: currentUserId,
        followingId: otherUserId,
        status: 'accepted'
      }
    });

    const isFollowedBy = await Follow.findOne({
      where: {
        followerId: otherUserId,
        followingId: currentUserId,
        status: 'accepted'
      }
    });

    // Require mutual follow to send messages
    if (!isFollowing || !isFollowedBy) {
      return res.status(403).json({ 
        msg: 'You can only send messages to users you follow and who follow you back',
        requiresFollowBack: true
      });
    }

    const message = await Message.create({
      senderId: currentUserId,
      receiverId: otherUserId,
      content: content.trim(),
      type: 'text',
    });

    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto']
          }]
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
    });

    res.json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// PUT /api/messaging/conversations/:conversationId/read - Mark conversation as read
router.put('/conversations/:conversationId/read', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;
    const otherUserId = parseInt(conversationId);

    // Here you would update messages as read
    // For now, just return success
    // You can add a 'read' boolean field to Message model later

    res.json({ msg: 'Marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Legacy routes for backward compatibility
// GET /api/messaging/:userId - Get messages with a user
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, receiverId: parseInt(userId) },
          { senderId: parseInt(userId), receiverId: currentUserId },
        ],
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto']
          }]
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/messaging/:userId - Send message to a user (legacy)
router.post('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ msg: 'Message content is required' });
    }

    // Check if users follow each other (mutual follow required)
    const isFollowing = await Follow.findOne({
      where: {
        followerId: currentUserId,
        followingId: parseInt(userId),
        status: 'accepted'
      }
    });

    const isFollowedBy = await Follow.findOne({
      where: {
        followerId: parseInt(userId),
        followingId: currentUserId,
        status: 'accepted'
      }
    });

    // Require mutual follow to send messages
    if (!isFollowing || !isFollowedBy) {
      return res.status(403).json({ 
        msg: 'You can only send messages to users you follow and who follow you back',
        requiresFollowBack: true
      });
    }

    const message = await Message.create({
      senderId: currentUserId,
      receiverId: parseInt(userId),
      content: content.trim(),
      type: 'text',
    });

    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            attributes: ['profilePhoto']
          }]
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
    });

    res.json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
