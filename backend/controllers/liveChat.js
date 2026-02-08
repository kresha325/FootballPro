const LiveChatMessage = require('../models/LiveChatMessage');

exports.sendMessage = async (req, res) => {
  try {
    const { streamId, userId, message } = req.body;
    const chatMessage = await LiveChatMessage.create({ streamId, userId, message });
    res.status(201).json(chatMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { streamId } = req.params;
    const messages = await LiveChatMessage.findAll({
      where: { streamId },
      order: [['timestamp', 'ASC']],
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};
