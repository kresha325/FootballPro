const { Op } = require('sequelize');
const Stream = require('../models/Stream');
const socketUtil = require('./socket');

/** Pa heartbeat nga broadcaster (default 15 min). */
const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;
/** Kohë maksimale absolute për një sesion live (default 2 orë). */
const DEFAULT_MAX_SESSION_MS = 2 * 60 * 60 * 1000;

function getHeartbeatMs() {
  const raw = process.env.STREAM_HEARTBEAT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HEARTBEAT_MS;
}

function getMaxSessionMs() {
  const raw = process.env.STREAM_MAX_LIVE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_SESSION_MS;
}

/** @deprecated — përdor getHeartbeatMs / getMaxSessionMs */
function getMaxLiveMs() {
  return getMaxSessionMs();
}

function emitStreamEnded(streamId) {
  try {
    const io = socketUtil.getIo();
    if (!io) return;
    const payload = { id: streamId };
    io.emit('stream:ended', payload);
    io.to('streams').emit('stream:ended', payload);
    io.to(`stream:${streamId}`).emit('stream:ended', payload);
  } catch (_e) {
    /* ignore */
  }
}

function isStreamStale(stream) {
  if (!stream?.isLive) return false;
  const now = Date.now();
  const updated = stream.updatedAt ? new Date(stream.updatedAt).getTime() : 0;
  const created = stream.createdAt ? new Date(stream.createdAt).getTime() : 0;

  if (created && now - created > getMaxSessionMs()) return true;
  if (updated && now - updated > getHeartbeatMs()) return true;
  return false;
}

/**
 * Mbyll stream-et live që kanë humbur heartbeat-in ose kanë tejkaluar kohën max.
 */
async function expireStaleLiveStreams() {
  const live = await Stream.findAll({
    where: { isLive: true },
    attributes: ['id', 'streamerId', 'createdAt', 'updatedAt', 'viewers', 'isLive'],
  });

  const staleIds = live.filter(isStreamStale).map((s) => s.id);
  if (!staleIds.length) return 0;

  await Stream.update(
    { isLive: false, viewers: 0 },
    { where: { id: { [Op.in]: staleIds } } }
  );

  for (const id of staleIds) {
    emitStreamEnded(id);
  }

  return staleIds.length;
}

async function endOtherLiveStreamsForStreamer(streamerId, exceptStreamId = null) {
  const where = {
    streamerId,
    isLive: true,
  };
  if (exceptStreamId != null) {
    where.id = { [Op.ne]: exceptStreamId };
  }

  const others = await Stream.findAll({ where, attributes: ['id'] });
  if (!others.length) return 0;

  const ids = others.map((s) => s.id);
  await Stream.update({ isLive: false, viewers: 0 }, { where: { id: { [Op.in]: ids } } });
  for (const id of ids) {
    emitStreamEnded(id);
  }
  return ids.length;
}

module.exports = {
  expireStaleLiveStreams,
  endOtherLiveStreamsForStreamer,
  isStreamStale,
  getMaxLiveMs,
  getHeartbeatMs,
  getMaxSessionMs,
};
