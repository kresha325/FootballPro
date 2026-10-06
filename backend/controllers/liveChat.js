const LiveChatMessage = require('../models/LiveChatMessage');

exports.sendMessage = async (req, res) => {
  try {
    const streamId = Number(req.body?.streamId);
    const message = String(req.body?.message || '').trim().slice(0, 500);
    if (!Number.isInteger(streamId) || streamId <= 0 || !message) {
      return res.status(400).json({ error: 'streamId dhe message janë të detyrueshme' });
    }
    const chatMessage = await LiveChatMessage.create({
      streamId,
      userId: req.user.id,
      message,
    });
    res.status(201).json(chatMessage);
  } catch (error) {
    console.error('live chat send:', error && error.message);
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
    console.error('live chat list:', error && error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};
