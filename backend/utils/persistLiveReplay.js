const { Op } = require('sequelize');
const { Stream, Profile, Post } = require('../models');
const Video = require('../models/Video');

const LIVE_CATEGORY = 'live';

/**
 * Ruaj regjistrimin e një transmetimi live:
 * - Streams.videoUrl + type recording
 * - Profile.liveVideos (seksioni "Live Videos" në profil)
 * - Video me category "live" (jo te lista e upload-eve normale)
 */
async function persistLiveReplay({
  userId,
  streamId = null,
  videoUrl,
  title = 'Live Stream',
  description = '',
  thumbnailUrl = null,
  duration = null,
  publicId = null,
}) {
  if (!userId || !videoUrl) {
    throw new Error('userId and videoUrl are required');
  }

  let stream = null;
  if (streamId) {
    stream = await Stream.findOne({ where: { id: streamId, streamerId: userId } });
  }
  if (!stream) {
    stream = await Stream.findOne({
      where: { streamerId: userId },
      order: [['updatedAt', 'DESC']],
    });
  }

  if (stream) {
    stream.videoUrl = videoUrl;
    stream.isLive = false;
    stream.type = 'recording';
    if (title) stream.title = title;
    if (description) stream.description = description;
    await stream.save();
  } else {
    stream = await Stream.create({
      title: title || 'Live Recording',
      description: description || '',
      streamerId: userId,
      isPremium: false,
      isLive: false,
      type: 'recording',
      streamKey: null,
      videoUrl,
    });
  }

  const profile = await Profile.findOne({ where: { userId } });
  let liveVideos = [];
  if (profile) {
    liveVideos = Array.isArray(profile.liveVideos) ? [...profile.liveVideos] : [];
    const entry = {
      url: videoUrl,
      title: title || stream.title || 'Live',
      thumbnail: thumbnailUrl || null,
      duration: duration != null ? duration : null,
      date: new Date().toISOString(),
      streamId: stream.id,
    };
    const idx = liveVideos.findIndex((v) => v && Number(v.streamId) === Number(stream.id));
    if (idx >= 0) liveVideos[idx] = { ...liveVideos[idx], ...entry };
    else liveVideos.unshift(entry);
    profile.liveVideos = liveVideos;
    await profile.save();
  }

  const existingLiveVideo = await Video.findOne({
    where: {
      userId,
      category: LIVE_CATEGORY,
      tags: { [Op.contains]: [`stream:${stream.id}`] },
    },
  });

  let videoRecord = existingLiveVideo;
  const tags = [`stream:${stream.id}`, 'live_replay'];
  if (videoRecord) {
    videoRecord.videoUrl = videoUrl;
    videoRecord.title = title || videoRecord.title;
    videoRecord.description = description || videoRecord.description;
    if (thumbnailUrl) videoRecord.thumbnailUrl = thumbnailUrl;
    if (duration != null) videoRecord.duration = Math.round(Number(duration)) || 0;
    if (publicId) videoRecord.publicId = publicId;
    await videoRecord.save();
  } else {
    videoRecord = await Video.create({
      userId,
      title: title || stream.title || 'Live Recording',
      description: description || '',
      videoUrl,
      publicId,
      thumbnailUrl,
      duration: duration != null ? Math.round(Number(duration)) || 0 : 0,
      category: LIVE_CATEGORY,
      tags,
      isPremium: false,
      isProcessing: false,
      processingStatus: 'completed',
    });
  }

  // Krijo/azhurno post në feed që streameri të ketë "Was live" te postet e veta.
  // E lidhim me URL-në /live/:id që të mos krijohen duplikate për të njëjtin stream.
  const replayLink = `/live/${stream.id}`;
  const replayContent = `🔴 Was live: ${title || stream.title || 'Live Stream'}\nShiko replay: ${replayLink}`;
  const [replayPost] = await Post.findOrCreate({
    where: {
      userId,
      content: { [Op.like]: `%${replayLink}` },
    },
    defaults: {
      userId,
      content: replayContent,
      videoUrl,
    },
  });
  if (replayPost) {
    let changed = false;
    if (replayPost.videoUrl !== videoUrl) {
      replayPost.videoUrl = videoUrl;
      changed = true;
    }
    if (replayPost.content !== replayContent) {
      replayPost.content = replayContent;
      changed = true;
    }
    if (changed) {
      await replayPost.save();
    }
  }

  return { stream, liveVideos, video: videoRecord };
}

module.exports = {
  persistLiveReplay,
  LIVE_CATEGORY,
};
