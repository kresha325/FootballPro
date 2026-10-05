const Follow = require('../models/Follow');
const Notification = require('../models/Notification');

const MAX_FOLLOWERS = 500;

function streamEventCopy(event, stream) {
  const title = stream?.title || 'Live';
  const link = stream?.id ? `/live/${stream.id}` : '/live';
  const map = {
    stream_starting_soon: {
      title: 'Live starting soon',
      message: `${title} starts soon.`,
    },
    stream_started: {
      title: 'Live started',
      message: `${title} is live now.`,
    },
    stream_ended: {
      title: 'Live ended',
      message: `${title} has ended.`,
    },
    replay_available: {
      title: 'Replay available',
      message: `Replay is ready for ${title}.`,
    },
    highlight_uploaded: {
      title: 'New highlight',
      message: stream?.message || `${title} posted a new highlight.`,
    },
  };
  const copy = map[event] || {
    title: 'Stream update',
    message: title,
  };
  return { ...copy, link, event };
}

async function notifyStreamFollowers(streamerId, event, stream) {
  const ownerId = Number(streamerId);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return 0;

  const copy = streamEventCopy(event, stream);
  const follows = await Follow.findAll({
    where: { followingId: ownerId, status: 'accepted' },
    attributes: ['followerId'],
    limit: MAX_FOLLOWERS,
  });
  if (!follows.length) return 0;

  const rows = follows
    .map((row) => Number(row.followerId))
    .filter((id) => Number.isFinite(id) && id > 0 && id !== ownerId)
    .map((followerId) => ({
      userId: followerId,
      actorId: ownerId,
      type: 'system',
      title: copy.title,
      message: copy.message,
      link: copy.link,
      entityType: event === 'highlight_uploaded' ? 'media' : 'stream',
      entityId: stream?.id || null,
      isRead: false,
      metadata: { event: copy.event, streamId: stream?.id || null },
    }));

  if (!rows.length) return 0;
  await Notification.bulkCreate(rows);
  return rows.length;
}

module.exports = {
  streamEventCopy,
  notifyStreamFollowers,
};
