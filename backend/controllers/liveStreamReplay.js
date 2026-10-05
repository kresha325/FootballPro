const LiveStreamReplay = require('../models/LiveStreamReplay');

exports.saveReplay = async (req, res) => {
  try {
    const { streamId, videoUrl, highlight } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
    const Stream = require('../models/Stream');
    const stream = await Stream.findByPk(streamId);
    if (!stream || Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    const replay = await LiveStreamReplay.create({
      streamId,
      userId: req.user.id,
      videoUrl,
      highlight: !!highlight,
    });
    res.status(201).json(replay);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save replay' });
  }
};

exports.getReplays = async (req, res) => {
  try {
    const { streamId } = req.params;
    const replays = await LiveStreamReplay.findAll({
      where: { streamId },
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(replays);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch replays' });
  }
};

exports.getHighlights = async (req, res) => {
  try {
    const { streamId } = req.params;
    const highlights = await LiveStreamReplay.findAll({
      where: { streamId, highlight: true },
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(highlights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
};
