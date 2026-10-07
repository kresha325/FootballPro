import { useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { messagingUnreadCountRequest, unreadNotificationsCountRequest } from '../api/client';

/**
 * One process-wide unread manager.
 * Every header and tab reads the same counts. Mounting another header does not
 * start another poll or another pair of requests.
 */
const POLL_MS = 45000;
const listeners = new Set();
let snapshot = { notificationsCount: 0, messagesCount: 0 };
let pollId = null;
let inFlight = null;
let lastRefreshAt = 0;
let socketBound = null;
let socketBump = null;
let appStateSub = null;
let pushSub = null;
let bumpTimer = null;

let lastUnreadDebug = '';

function logUnreadDebug(reason) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const line = `${listeners.size}|${pollId ? 1 : 0}|${socketBound ? 1 : 0}`;
  if (line === lastUnreadDebug) return;
  lastUnreadDebug = line;
  console.log('[UNREAD]', reason, {
    activeUnreadListeners: listeners.size,
    activeUnreadPollers: pollId ? 1 : 0,
    activeSocketListeners: socketBound ? 1 : 0,
  });
}

function emit() {
  listeners.forEach((listener) => listener(snapshot));
}

async function refreshUnread() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        unreadNotificationsCountRequest(),
        messagingUnreadCountRequest(),
      ]);
      const nextNotif = Number(notifRes?.data?.count ?? notifRes?.data?.unread ?? 0);
      const nextMsg = Number(
        msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0
      );
      snapshot = { notificationsCount: nextNotif, messagesCount: nextMsg };
      lastRefreshAt = Date.now();
      emit();
      const badgeTotal = Math.max(0, nextNotif + nextMsg);
      Notifications.setBadgeCountAsync(badgeTotal).catch(() => {});
    } catch (_err) {
      /* keep the last counts */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function scheduleBump() {
  if (bumpTimer) return;
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    refreshUnread();
  }, 400);
}

function bindSocket(getSocket) {
  const socket = getSocket?.();
  if (!socket || socket === socketBound) return;
  if (socketBound && socketBump) {
    socketBound.off('newMessage', socketBump);
    socketBound.off('messageUpdated', socketBump);
    socketBound.off('messageDeleted', socketBump);
    socketBound.off('notification:new', socketBump);
    socketBound.off('notification:unread', socketBump);
  }
  socketBound = socket;
  socketBump = () => scheduleBump();
  socket.on('newMessage', socketBump);
  socket.on('messageUpdated', socketBump);
  socket.on('messageDeleted', socketBump);
  socket.on('notification:new', socketBump);
  socket.on('notification:unread', socketBump);
}

function ensureStarted(getSocket) {
  bindSocket(getSocket);
  if (!pollId) {
    pollId = setInterval(() => {
      if (AppState.currentState === 'active') refreshUnread();
    }, POLL_MS);
  }
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRefreshAt > 15000) refreshUnread();
    });
  }
  if (!pushSub) {
    pushSub = DeviceEventEmitter.addListener('notifications-refresh', () => scheduleBump());
  }
  if (!lastRefreshAt) refreshUnread();
  logUnreadDebug('started');
}

function stopIfIdle() {
  if (listeners.size > 0) return;
  if (pollId) {
    clearInterval(pollId);
    pollId = null;
  }
  if (bumpTimer) {
    clearTimeout(bumpTimer);
    bumpTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (pushSub) {
    pushSub.remove();
    pushSub = null;
  }
  if (socketBound && socketBump) {
    socketBound.off('newMessage', socketBump);
    socketBound.off('messageUpdated', socketBump);
    socketBound.off('messageDeleted', socketBump);
    socketBound.off('notification:new', socketBump);
    socketBound.off('notification:unread', socketBump);
  }
  socketBound = null;
  socketBump = null;
  logUnreadDebug('stopped');
}

export function useUnreadBadges(getSocket, socketConnected = false) {
  const [counts, setCounts] = useState(snapshot);

  useEffect(() => {
    listeners.add(setCounts);
    setCounts(snapshot);
    ensureStarted(getSocket);
    logUnreadDebug('subscribe');
    return () => {
      listeners.delete(setCounts);
      stopIfIdle();
      logUnreadDebug('unsubscribe');
    };
  }, [getSocket]);

  useEffect(() => {
    if (listeners.size > 0) bindSocket(getSocket);
  }, [getSocket, socketConnected]);

  return { ...counts, refresh: refreshUnread };
}
