const LiveReaction = require('../models/LiveReaction');

exports.sendReaction = async (req, res) => {
  try {
    const { streamId, userId, emoji } = req.body;
    const reaction = await LiveReaction.create({ streamId, userId, emoji });
    res.status(201).json(reaction);
  } catch (error) {
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
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
};
