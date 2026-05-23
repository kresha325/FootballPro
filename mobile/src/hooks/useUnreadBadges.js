import { useCallback, useEffect, useState } from 'react';
import { messagingUnreadCountRequest, unreadNotificationsCountRequest } from '../api/client';

/**
 * Unread counts: notifications (bell / More tab) vs messages (Chats tab).
 * Matches web Navbar burger (notifications on icon) + separate Messages link.
 */
export function useUnreadBadges(getSocket) {
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        unreadNotificationsCountRequest(),
        messagingUnreadCountRequest(),
      ]);
      setNotificationsCount(Number(notifRes?.data?.count ?? notifRes?.data?.unread ?? 0));
      setMessagesCount(
        Number(msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0)
      );
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
  }, [getSocket, refresh]);

  return { notificationsCount, messagesCount, refresh };
}
