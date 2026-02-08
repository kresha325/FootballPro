const LiveChatMessage = require('../models/LiveChatMessage');

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await LiveChatMessage.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    await message.destroy();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    // Implement logic to block user from sending messages (e.g., add to blocked list)
    // For demo: just return success
    res.status(200).json({ success: true, userId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to block user' });
  }
};
