const LiveStream = require('../models/LiveStream');
const LiveStreamAnalytics = require('../models/LiveStreamAnalytics');

async function ownedStream(streamId, userId) {
  const stream = await LiveStream.findByPk(streamId, { attributes: ['id', 'userId'] });
  if (!stream) return { error: 404, msg: 'Stream not found' };
  if (Number(stream.userId) !== Number(userId)) return { error: 403, msg: 'Only the stream owner can change analytics' };
  return { stream };
}

exports.startStreamAnalytics = async (req, res) => {
  try {
    const streamId = Number(req.body?.streamId);
    if (!streamId) return res.status(400).json({ error: 'streamId is required' });
    const access = await ownedStream(streamId, req.user.id);
    if (access.error) return res.status(access.error).json({ error: access.msg });
    const existing = await LiveStreamAnalytics.findOne({ where: { streamId } });
    if (existing) return res.status(200).json(existing);
    const analytics = await LiveStreamAnalytics.create({ streamId, startedAt: new Date(), viewers: 0, peakViewers: 0 });
    res.status(201).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start analytics' });
  }
};

exports.updateViewers = async (req, res) => {
  try {
    const access = await ownedStream(req.params.streamId, req.user.id);
    if (access.error) return res.status(access.error).json({ error: access.msg });
    const viewers = Math.max(0, parseInt(req.body?.viewers, 10) || 0);
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId: access.stream.id } });
    if (!analytics) return res.status(404).json({ error: 'Analytics not found' });
    analytics.viewers = viewers;
    analytics.peakViewers = Math.max(Number(analytics.peakViewers) || 0, viewers);
    await analytics.save();
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update viewers' });
  }
};

exports.endStreamAnalytics = async (req, res) => {
  try {
    const access = await ownedStream(req.params.streamId, req.user.id);
    if (access.error) return res.status(access.error).json({ error: access.msg });
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId: access.stream.id } });
    if (!analytics) return res.status(404).json({ error: 'Analytics not found' });
    analytics.endedAt = new Date();
    analytics.duration = Math.max(0, Math.floor((analytics.endedAt - new Date(analytics.startedAt)) / 1000));
    await analytics.save();
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to end analytics' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const access = await ownedStream(req.params.streamId, req.user.id);
    if (access.error) return res.status(access.error).json({ error: access.msg });
    const analytics = await LiveStreamAnalytics.findOne({ where: { streamId: access.stream.id } });
    if (!analytics) return res.status(404).json({ error: 'Analytics not found' });
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
