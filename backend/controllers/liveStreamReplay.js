const LiveStreamReplay = require('../models/LiveStreamReplay');

exports.saveReplay = async (req, res) => {
  try {
    const { streamId, userId, videoUrl, highlight } = req.body;
    const replay = await LiveStreamReplay.create({ streamId, userId, videoUrl, highlight });
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
