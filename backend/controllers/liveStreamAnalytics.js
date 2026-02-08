const LiveStreamAnalytics = require('../models/LiveStreamAnalytics');

exports.startStreamAnalytics = async (req, res) => {
  try {
    const { streamId } = req.body;
    const analytics = await LiveStreamAnalytics.create({ streamId, startedAt: new Date() });
    res.status(201).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start analytics' });
  }
};

exports.updateViewers = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { viewers } = req.body;
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId } });
    if (!analytics) return res.status(404).json({ error: 'Analytics not found' });
    analytics.viewers = viewers;
    await analytics.save();
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update viewers' });
  }
};

exports.endStreamAnalytics = async (req, res) => {
  try {
    const { streamId } = req.params;
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId } });
    if (!analytics) return res.status(404).json({ error: 'Analytics not found' });
    analytics.endedAt = new Date();
    analytics.duration = Math.floor((analytics.endedAt - analytics.startedAt) / 1000);
    await analytics.save();
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to end analytics' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { streamId } = req.params;
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId } });
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
