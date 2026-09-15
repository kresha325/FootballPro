let ioInstance = null;

/** userId -> Set of socketIds (supports multiple tabs/devices) */
const onlineByUser = new Map();

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function markUserOnline(userId, socketId) {
  if (userId == null || !socketId) return;
  const key = String(userId);
  let set = onlineByUser.get(key);
  if (!set) {
    set = new Set();
    onlineByUser.set(key, set);
  }
  set.add(String(socketId));
}

function markUserOffline(userId, socketId) {
  if (userId == null) return;
  const key = String(userId);
  const set = onlineByUser.get(key);
  if (!set) return;
  if (socketId) set.delete(String(socketId));
  else set.clear();
  if (set.size === 0) onlineByUser.delete(key);
}

function isUserOnline(userId) {
  if (userId == null) return false;
  const set = onlineByUser.get(String(userId));
  return !!(set && set.size > 0);
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
  getOnlineUsersCount,
};
