import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { messagingUnreadCountRequest, unreadNotificationsCountRequest } from '../api/client';

/**
 * Unread counts: notifications (bell / More tab) vs messages (Chats tab).
 * Matches web Navbar burger (notifications on icon) + separate Messages link.
 * Also syncs iOS/Android app-icon badge when counts change.
 */
export function useUnreadBadges(getSocket, socketConnected = false) {
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        unreadNotificationsCountRequest(),
        messagingUnreadCountRequest(),
      ]);
      const nextNotif = Number(notifRes?.data?.count ?? notifRes?.data?.unread ?? 0);
      const nextMsg = Number(
        msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0
      );
      setNotificationsCount(nextNotif);
      setMessagesCount(nextMsg);
      const badgeTotal = Math.max(0, nextNotif + nextMsg);
      try {
        await Notifications.setBadgeCountAsync(badgeTotal);
      } catch (_badgeErr) {
        /* simulator / permission */
      }
    } catch (_err) {
      // Keep previous values on failure.
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return undefined;
    const bump = () => refresh();
    socket.on('newMessage', bump);
    socket.on('messageUpdated', bump);
    socket.on('messageDeleted', bump);
    return () => {
      socket.off('newMessage', bump);
      socket.off('messageUpdated', bump);
      socket.off('messageDeleted', bump);
    };
  }, [getSocket, socketConnected, refresh]);

  return { notificationsCount, messagesCount, refresh };
}
