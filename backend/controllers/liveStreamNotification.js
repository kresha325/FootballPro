const Stream = require('../models/Stream');
const { notifyStreamFollowers } = require('../utils/streamNotifications');

exports.sendLiveNotification = async (req, res) => {
  try {
    const streamId = req.body?.streamId;
    const stream = await Stream.findByPk(streamId);
    if (!stream || Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ msg: 'Nuk je i autorizuar' });
    }
    const event = ['stream_started', 'stream_ended', 'replay_available', 'stream_starting_soon'].includes(req.body?.event)
      ? req.body.event
      : 'stream_started';
    const sent = await notifyStreamFollowers(req.user.id, event, stream);
    res.status(201).json({ success: true, sent });
  } catch (error) {
    res.status(500).json({ msg: 'Dërgimi i njoftimeve live dështoi' });
  }
};
