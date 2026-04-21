const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const { Conversation, ConversationMember } = require('../models/Conversation');
const { Op } = require('sequelize');

// Total unread messages across all conversations (for tab badge, etc.)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      attributes: ['id'],
      include: [
        {
          model: ConversationMember,
          as: 'memberships',
          where: { userId: req.user.id },
          attributes: ['lastReadAt'],
        },
      ],
    });

    const counts = await Promise.all(
      conversations.map(async (conv) => {
        const membership = conv.memberships && conv.memberships[0];
        if (!membership) return 0;
        return Message.count({
          where: {
            conversationId: conv.id,
            senderId: { [Op.ne]: req.user.id },
            deleted: false,
            createdAt: {
              [Op.gt]: membership.lastReadAt || new Date(0),
            },
          },
        });
      })
    );

    const total = counts.reduce((a, b) => a + b, 0);
    res.json({ count: total, unreadCount: total });
  } catch (err) {
    console.error('messaging unread-count error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
