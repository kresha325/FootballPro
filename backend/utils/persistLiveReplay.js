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
  visibility = 'public',
}) {
  if (!userId || !videoUrl) {
    throw new Error('userId and videoUrl are required');
  }

  let stream = null;
  const normalizedVisibility = ['public', 'unlisted', 'private'].includes(String(visibility).toLowerCase())
    ? String(visibility).toLowerCase()
    : 'public';
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
    // Never widen an already more-restricted stream when attaching its replay.
    const rank = { public: 0, unlisted: 1, private: 2 };
    if (rank[stream.visibility] > rank[normalizedVisibility]) visibility = stream.visibility;
    else visibility = normalizedVisibility;
    stream.videoUrl = videoUrl;
    stream.isLive = false;
    stream.type = 'recording';
    stream.status = 'available';
    stream.visibility = visibility;
    stream.endedAt = stream.endedAt || new Date();
    if (thumbnailUrl) stream.thumbnailUrl = thumbnailUrl;
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
      status: 'available',
      visibility: normalizedVisibility,
      provider: 'upload',
      streamKey: null,
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      endedAt: new Date(),
    });
  }

  const profile = await Profile.findOne({ where: { userId } });
  let liveVideos = [];
  if (profile && visibility === 'public') {
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
  } else if (profile) {
    profile.liveVideos = (Array.isArray(profile.liveVideos) ? profile.liveVideos : [])
      .filter((entry) => Number(entry?.streamId) !== Number(stream.id));
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
    videoRecord.visibility = visibility;
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
      provider: 'upload',
      providerId: publicId || `stream-replay:${stream.id}`,
      visibility,
      playerId: stream.playerId || userId,
      matchId: stream.matchId || null,
      tournamentId: stream.tournamentId || null,
      featured: false,
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
      videoUrl: visibility === 'public' ? videoUrl : null,
    },
  });
  if (replayPost) {
    let changed = false;
    const postVideoUrl = visibility === 'public' ? videoUrl : null;
    if (replayPost.videoUrl !== postVideoUrl) {
      replayPost.videoUrl = postVideoUrl;
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

  try {
    const { notifyStreamFollowers } = require('./streamNotifications');
    await notifyStreamFollowers(userId, 'replay_available', stream);
  } catch (_notifyErr) {
    /* notifications must not fail replay persistence */
  }

  return { stream, liveVideos, video: videoRecord };
}

module.exports = {
  persistLiveReplay,
  LIVE_CATEGORY,
};
