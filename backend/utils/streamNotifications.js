const logger = require('./logger');
const Follow = require('../models/Follow');
const { notify } = require('../services/notifications/service');
const { idempotencyKey } = require('../services/notifications/policy');

const MAX_FOLLOWERS = 500;

const STREAM_EVENTS = {
  stream_starting_soon: 'STREAM_STARTING',
  stream_started: 'STREAM_STARTED',
  stream_ended: 'STREAM_ENDED',
  replay_available: 'REPLAY_AVAILABLE',
  highlight_uploaded: 'HIGHLIGHT_UPLOADED',
  match_video: 'MATCH_VIDEO',
};

function streamEventCopy(event, stream) {
  const titleName = stream?.title || 'Live';
  const link = stream?.id ? `/live/${stream.id}` : '/live';
  const map = {
    stream_starting_soon: { title: 'Live së shpejti', message: `${titleName} fillon së shpejti.` },
    stream_started: { title: 'Live filloi', message: `${titleName} është live tani.` },
    stream_ended: { title: 'Live përfundoi', message: `${titleName} përfundoi.` },
    replay_available: { title: 'Replay gati', message: `Replay është gati për ${titleName}.` },
    highlight_uploaded: { title: 'Highlight i ri', message: stream?.message || `${titleName} publikoi një highlight.` },
    match_video: { title: 'Video e ndeshjes', message: stream?.message || `Videoja e ndeshjes është gati: ${titleName}.` },
  };
  const copy = map[event] || { title: 'Përditësim live', message: titleName };
  return { ...copy, link, event };
}

async function notifyStreamFollowers(streamerId, event, stream) {
  const ownerId = Number(streamerId);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return 0;
  const copy = streamEventCopy(event, stream);
  const eventType = STREAM_EVENTS[event] || 'STREAM_STARTED';
  const follows = await Follow.findAll({
    where: { followingId: ownerId, status: 'accepted' },
    attributes: ['followerId'],
    limit: MAX_FOLLOWERS,
  });
  if (!follows.length) return 0;
  const entityType = event === 'highlight_uploaded' || event === 'match_video' ? 'media' : 'stream';
  let sent = 0;
  for (const row of follows) {
    const followerId = Number(row.followerId);
    if (!Number.isFinite(followerId) || followerId <= 0 || followerId === ownerId) continue;
    try {
      const created = await notify({
        userId: followerId,
        actorId: ownerId,
        eventType,
        title: copy.title,
        message: copy.message,
        link: copy.link,
        entityType,
        entityId: stream?.id || null,
        idempotencyKey: idempotencyKey([eventType, entityType, stream?.id || 'x', 'user', followerId]),
        metadata: { event: copy.event, streamId: stream?.id || null },
      });
      if (created && !created.duplicate) sent += 1;
    } catch (err) {
      logger.warn('stream notification', followerId, err?.message || err);
    }
  }
  return sent;
}

module.exports = { streamEventCopy, notifyStreamFollowers };
