let ioInstance = null;

/** userId -> Set of socketIds (supports multiple tabs/devices) */
const onlineByUser = new Map();
/** userId -> Date (in-memory last offline time; mirrored to DB) */
const lastSeenByUser = new Map();

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function markUserOnline(userId, socketId) {
  if (userId == null || !socketId) return { becameOnline: false };
  const key = String(userId);
  let set = onlineByUser.get(key);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    onlineByUser.set(key, set);
  }
  set.add(String(socketId));
  return { becameOnline: wasOffline };
}

function markUserOffline(userId, socketId) {
  if (userId == null) return { becameOffline: false, lastSeenAt: null };
  const key = String(userId);
  const set = onlineByUser.get(key);
  if (!set) return { becameOffline: false, lastSeenAt: null };
  if (socketId) set.delete(String(socketId));
  else set.clear();
  if (set.size === 0) {
    onlineByUser.delete(key);
    const lastSeenAt = new Date();
    lastSeenByUser.set(key, lastSeenAt);
    return { becameOffline: true, lastSeenAt };
  }
  return { becameOffline: false, lastSeenAt: null };
}

function isUserOnline(userId) {
  if (userId == null) return false;
  const set = onlineByUser.get(String(userId));
  return !!(set && set.size > 0);
}

function getLastSeen(userId) {
  if (userId == null) return null;
  return lastSeenByUser.get(String(userId)) || null;
}

function setLastSeenCache(userId, date) {
  if (userId == null || !date) return;
  lastSeenByUser.set(String(userId), date instanceof Date ? date : new Date(date));
}

/** Distinct authenticated users with at least one connected socket. */
function getOnlineUsersCount() {
  return onlineByUser.size;
}

module.exports = {
  setIo,
  getIo,
  markUserOnline,
  markUserOffline,
  isUserOnline,
  getLastSeen,
  setLastSeenCache,
  getOnlineUsersCount,
};
