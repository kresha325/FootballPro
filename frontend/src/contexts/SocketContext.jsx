import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { BACKEND_URL } from '../config/api';
import { showXPNotification } from '../components/XPNotificationManager';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }


    // Prefer explicit backend URL from env; fallback to BACKEND_URL
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/i, '')
      : BACKEND_URL;
    console.log('🔗 Connecting to Socket.IO:', socketUrl);

    // Keep the connection on polling when the deployment proxy cannot complete
    // WebSocket upgrades. Socket.IO still provides real-time events without the
    // failed upgrade/reconnect noise in the browser console.
    const newSocket = io(socketUrl, {
      auth: {
        token: localStorage.getItem('token') || user.token || '',
        userId: user.id,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['polling'],
      upgrade: false,
      path: '/socket.io',
      withCredentials: true,
    });

    const bumpMessagingUnread = () => {
      try {
        window.dispatchEvent(new CustomEvent('messaging-unread-changed'));
      } catch (_e) {
        /* ignore */
      }
    };

    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      setConnected(true);
      // Server joins the JWT identity room; client emit is ignored for spoofing
      newSocket.emit('join');
    });

    newSocket.on('newMessage', bumpMessagingUnread);
    newSocket.on('messageUpdated', bumpMessagingUnread);
    newSocket.on('messageDeleted', bumpMessagingUnread);

    const onXpEarned = (data) => {
      if (!data || typeof data !== 'object') return;
      showXPNotification(data.xp ?? 0, data.reason ?? '', data.levelUp ?? null);
    };
    newSocket.on('xp:earned', onXpEarned);
    newSocket.on('notification:new', (payload) => {
      window.dispatchEvent(new CustomEvent('notification-received', { detail: payload }));
    });
    newSocket.on('notification:unread', (payload) => {
      window.dispatchEvent(new CustomEvent('notifications-unread-changed', { detail: payload || {} }));
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('newMessage', bumpMessagingUnread);
      newSocket.off('messageUpdated', bumpMessagingUnread);
      newSocket.off('messageDeleted', bumpMessagingUnread);
      newSocket.off('xp:earned', onXpEarned);
      newSocket.off('notification:new');
      newSocket.off('notification:unread');
      newSocket.close();
    };
  }, [user]);

  const value = {
    socket,
    connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
