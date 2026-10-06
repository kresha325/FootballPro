const LiveReaction = require('../models/LiveReaction');

exports.sendReaction = async (req, res) => {
  try {
    const streamId = Number(req.body?.streamId);
    const emoji = String(req.body?.emoji || '').trim().slice(0, 16);
    if (!Number.isInteger(streamId) || streamId <= 0 || !emoji || /[<>]/.test(emoji)) {
      return res.status(400).json({ error: 'Reagim i pavlefshëm' });
    }
    const reaction = await LiveReaction.create({
      streamId,
      userId: req.user.id,
      emoji,
    });
    res.status(201).json(reaction);
  } catch (error) {
    console.error('live reaction:', error && error.message);
    res.status(500).json({ error: 'Failed to send reaction' });
  }
};

exports.getReactions = async (req, res) => {
  try {
    const { streamId } = req.params;
    const reactions = await LiveReaction.findAll({
      where: { streamId },
      order: [['timestamp', 'ASC']],
    });
    res.status(200).json(reactions);
  } catch (error) {
    console.error('live reaction list:', error && error.message);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
};
