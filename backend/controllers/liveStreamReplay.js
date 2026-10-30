const LiveStreamReplay = require('../models/LiveStreamReplay');
const Stream = require('../models/Stream');
const cloudinary = require('../utils/cloudinary');
const { canViewStream } = require('../utils/streamPublic');
const { publicCloudinaryAsset, authenticatedDeliveryUrl } = require('../utils/cloudinaryMediaDelivery');

async function visibleStream(streamId, viewerId) {
  const stream = await Stream.findByPk(streamId);
  return canViewStream(stream, viewerId) ? stream : null;
}

exports.saveReplay = async (req, res) => {
  try {
    const { streamId, videoUrl, highlight } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
    const stream = await Stream.findByPk(streamId);
    if (!stream || Number(stream.streamerId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Nuk je i autorizuar' });
    }
    let safeVideoUrl = videoUrl;
    if (stream.visibility !== 'public' && !/\/authenticated\//.test(videoUrl)) {
      const asset = publicCloudinaryAsset(videoUrl);
      if (!asset) return res.status(400).json({ error: 'Private replay must use authenticated Cloudinary media.' });
      await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
        resource_type: asset.resourceType, type: 'upload', to_type: 'authenticated', invalidate: true,
      });
      safeVideoUrl = authenticatedDeliveryUrl(videoUrl);
    }
    const replay = await LiveStreamReplay.create({
      streamId,
      userId: req.user.id,
      videoUrl: safeVideoUrl,
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
    if (!await visibleStream(streamId, req.user?.id)) return res.status(404).json({ error: 'Stream not found' });
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
    if (!await visibleStream(streamId, req.user?.id)) return res.status(404).json({ error: 'Stream not found' });
    const highlights = await LiveStreamReplay.findAll({
      where: { streamId, highlight: true },
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(highlights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
};
