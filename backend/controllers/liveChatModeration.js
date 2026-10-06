const LiveChatMessage = require('../models/LiveChatMessage');
const LiveStream = require('../models/LiveStream');
const Stream = require('../models/Stream');

async function canModerateMessage(user, message) {
  if (!user || !message) return false;
  if (user.role === 'admin') return true;
  if (Number(message.userId) === Number(user.id)) return true;
  const live = await LiveStream.findByPk(message.streamId);
  if (live && Number(live.userId) === Number(user.id)) return true;
  const stream = await Stream.findByPk(message.streamId);
  if (stream && Number(stream.streamerId) === Number(user.id)) return true;
  return false;
}

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await LiveChatMessage.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (!(await canModerateMessage(req.user, message))) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    await message.destroy();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('live chat delete:', error && error.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

exports.blockUser = async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  return res.status(501).json({ error: 'Bllokimi i përdoruesit nuk është i aktivizuar' });
};
