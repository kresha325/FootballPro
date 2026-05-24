/** Koha më e hershme kur të gjithë të tjerët kanë lexuar (për “seen”). */
export function othersReadFloor(othersRead) {
  if (!Array.isArray(othersRead) || othersRead.length === 0) return null;
  const times = othersRead
    .map((o) => (o?.lastReadAt ? new Date(o.lastReadAt).getTime() : 0))
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  return Math.min(...times);
}

/** Status për mesazhet e mia: sending | delivered | seen | failed */
export function outboundMessageStatus(message, othersRead, currentUserId) {
  const sid = message?.senderId ?? message?.sender?.id;
  if (sid == null || currentUserId == null || Number(sid) !== Number(currentUserId)) {
    return null;
  }
  if (message._sendFailed) return 'failed';
  // Spinner vetëm gjatë ngarkimit të medias; teksti merr ✓ menjëherë.
  if (message._pending) return 'sending';
  const msgTime = new Date(message.createdAt).getTime();
  const floor = othersReadFloor(othersRead);
  if (!Number.isNaN(msgTime) && floor != null && floor >= msgTime) {
    return 'seen';
  }
  if (message?.id != null) return 'delivered';
  return 'sending';
}

export function mergeOthersRead(prev, userId, readAt) {
  const list = Array.isArray(prev) ? [...prev] : [];
  const iso = readAt || new Date().toISOString();
  const idx = list.findIndex((o) => Number(o.userId) === Number(userId));
  if (idx >= 0) {
    const prevT = list[idx].lastReadAt ? new Date(list[idx].lastReadAt).getTime() : 0;
    const nextT = new Date(iso).getTime();
    if (nextT > prevT) {
      list[idx] = { ...list[idx], lastReadAt: iso };
    }
    return list;
  }
  return [...list, { userId, lastReadAt: iso }];
}
