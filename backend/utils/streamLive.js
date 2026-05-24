const { Op } = require('sequelize');
const Stream = require('../models/Stream');
const socketUtil = require('./socket');

/** Kohë maksimale që një stream mund të qëndrojë "live" pa aktivitet (default 6 orë). */
const DEFAULT_MAX_LIVE_MS = 6 * 60 * 60 * 1000;

function getMaxLiveMs() {
  const raw = process.env.STREAM_MAX_LIVE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_LIVE_MS;
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

/**
 * Mbyll stream-et me isLive=true që nuk janë përditësuar që nga maxLiveMs.
 * Kthen numrin e stream-eve të mbyllura.
 */
async function expireStaleLiveStreams() {
  const cutoff = new Date(Date.now() - getMaxLiveMs());
  const stale = await Stream.findAll({
    where: {
      isLive: true,
      updatedAt: { [Op.lt]: cutoff },
    },
    attributes: ['id', 'streamerId'],
  });

  if (!stale.length) return 0;

  const ids = stale.map((s) => s.id);
  await Stream.update(
    { isLive: false, viewers: 0 },
    { where: { id: { [Op.in]: ids } } }
  );

  for (const id of ids) {
    emitStreamEnded(id);
  }

  return stale.length;
}

/**
 * Mbyll të gjitha stream-et live të një streameri, përveç opsionalisht një të ri.
 */
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

function isStreamStale(stream) {
  if (!stream?.isLive) return false;
  const updated = stream.updatedAt ? new Date(stream.updatedAt) : null;
  if (!updated || Number.isNaN(updated.getTime())) return true;
  return Date.now() - updated.getTime() > getMaxLiveMs();
}

module.exports = {
  expireStaleLiveStreams,
  endOtherLiveStreamsForStreamer,
  isStreamStale,
  getMaxLiveMs,
};
