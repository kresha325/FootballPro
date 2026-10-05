'use strict';

const { Op } = require('sequelize');
const { TAG_TO_CATEGORY } = require('../../utils/highlightTags');
const { engagementRate } = require('./formulas');
const { createdBetween } = require('./formulas');
const { remember, TTL } = require('./cache');

const HIGHLIGHT_CATEGORIES = Object.values(TAG_TO_CATEGORY);

function videoEngagement(likes, views) {
  const rate = engagementRate({ likes, comments: 0, shares: 0, impressions: views });
  return {
    ...rate,
    commentsTracked: false,
    sharesTracked: false,
  };
}

async function videoAnalytics(userId, range) {
  return remember(`video:${userId}:${range?.key || 'all'}`, TTL.video, async () => {
    const Video = require('../../models/Video');
    const MediaItem = require('../../models/MediaItem');
    const MediaEvent = require('../../models/MediaEvent');
    const Stream = require('../../models/Stream');
    const LiveStream = require('../../models/LiveStream');
    const LiveStreamAnalytics = require('../../models/LiveStreamAnalytics');
    const between = createdBetween(range);
    const videoWhere = {
      [Op.and]: [
        { [Op.or]: [{ userId }, { playerId: userId }] },
        ...(between ? [{ createdAt: between }] : []),
      ],
    };
    const [count, views, likes, highlightViews, videos] = await Promise.all([
      Video.count({ where: videoWhere }),
      Video.sum('views', { where: videoWhere }),
      Video.sum('likes', { where: videoWhere }),
      Video.sum('views', { where: { ...videoWhere, category: { [Op.in]: HIGHLIGHT_CATEGORIES } } }),
      Video.findAll({
        where: videoWhere,
        attributes: ['id', 'title', 'views', 'likes', 'category', 'matchId', 'tournamentId', 'createdAt'],
        order: [['views', 'DESC']],
        limit: 5,
        raw: true,
      }),
    ]);
    const mediaWhere = {
      [Op.or]: [{ playerId: userId }, { uploadedBy: userId }],
    };
    const mediaViews = await MediaEvent.count({
      include: [{ model: MediaItem, as: 'media', attributes: [], where: mediaWhere, required: true }],
      where: {
        eventType: { [Op.in]: ['open', 'page_open'] },
        ...(between ? { createdAt: between } : {}),
      },
    });

    const streamWhere = { streamerId: userId };
    if (between) streamWhere.startedAt = between;
    const streams = await Stream.findAll({
      where: streamWhere,
      attributes: ['id', 'isLive', 'viewers', 'startedAt', 'endedAt', 'matchId', 'tournamentId'],
      raw: true,
    });
    let durationSeconds = 0;
    let streamsEnded = 0;
    let liveViewersNow = 0;
    for (const stream of streams) {
      if (stream.isLive) liveViewersNow += Number(stream.viewers) || 0;
      if (stream.startedAt && stream.endedAt) {
        const seconds = Math.floor((new Date(stream.endedAt) - new Date(stream.startedAt)) / 1000);
        if (seconds > 0) {
          durationSeconds += seconds;
          streamsEnded += 1;
        }
      }
    }

    const legacy = await LiveStream.findAll({
      where: between ? { userId, startedAt: between } : { userId },
      attributes: ['id'],
      raw: true,
    });
    const legacyIds = legacy.map((row) => row.id);
    const legacyAnalytics = legacyIds.length
      ? await LiveStreamAnalytics.findAll({ where: { streamId: { [Op.in]: legacyIds } }, raw: true })
      : [];
    const peakCandidates = legacyAnalytics.map((row) => Number(row.peakViewers || row.viewers) || 0);
    const legacyPeak = peakCandidates.length ? Math.max(...peakCandidates) : null;

    return {
      videos: {
        count,
        views: Number(views) || 0,
        highlightViews: Number(highlightViews) || 0,
        mediaViews,
        likes: Number(likes) || 0,
        engagement: videoEngagement(Number(likes) || 0, Number(views) || 0),
        top: videos.map((row) => ({
          id: row.id,
          title: row.title,
          views: Number(row.views) || 0,
          likes: Number(row.likes) || 0,
          category: row.category,
          engagement: videoEngagement(row.likes, row.views),
        })),
      },
      streams: {
        source: 'Stream',
        streamsStarted: streams.filter((row) => row.startedAt).length,
        streamsEnded,
        liveNow: streams.filter((row) => row.isLive).length,
        liveViewersNow,
        durationSeconds,
        peakConcurrentViewers: null,
        peakConcurrentViewersReason: 'Stream stores the current viewer count, not a peak series.',
        averageWatchTime: null,
        averageWatchTimeReason: 'Watch time is not recorded by the stream provider.',
        replayViews: null,
        replayViewsReason: 'Replay views are counted only when a Video row exists. Use video views.',
      },
      legacyLive: {
        source: 'LiveStream',
        streams: legacy.length,
        peakViewers: legacyPeak,
        peakViewersNote: legacyPeak == null ? 'No legacy stream analytics rows.' : 'Peak of reported viewer snapshots on LiveStreamAnalytics.',
      },
    };
  });
}

async function competitionVideo(tournamentId) {
  const Video = require('../../models/Video');
  const Stream = require('../../models/Stream');
  const [views, highlightViews, liveViewersNow, streamsStarted] = await Promise.all([
    Video.sum('views', { where: { tournamentId } }),
    Video.sum('views', { where: { tournamentId, category: { [Op.in]: HIGHLIGHT_CATEGORIES } } }),
    Stream.sum('viewers', { where: { tournamentId, isLive: true } }),
    Stream.count({ where: { tournamentId, startedAt: { [Op.ne]: null } } }),
  ]);
  return {
    videoViews: Number(views) || 0,
    highlightViews: Number(highlightViews) || 0,
    liveViewersNow: Number(liveViewersNow) || 0,
    streamsStarted,
    attendance: null,
    attendanceReason: 'Matches do not store attendance.',
    peakConcurrentViewers: null,
    averageWatchTime: null,
  };
}

module.exports = {
  videoAnalytics,
  competitionVideo,
  videoEngagement,
};
