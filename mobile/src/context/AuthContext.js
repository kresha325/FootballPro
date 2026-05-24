import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';
import { BACKEND_URL } from '../config/constants';
import {
  extractErrorMessage,
  forgotPasswordRequest,
  loginRequest,
  meRequest,
  registerRequest,
  setAuthToken,
} from '../api/client';
import { showXpNotification } from '../utils/xpNotifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketConnected(false);
  };

  const connectSocket = (authToken, userData) => {
    disconnectSocket();

    const socket = io(BACKEND_URL, {
      auth: {
        token: authToken,
        userId: userData?.id,
      },
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      const room = userData?.id ? String(userData.id) : `mobile-${socket.id}`;
      socket.emit('join', room);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    socket.on('xp:earned', (data) => {
      if (!data || typeof data !== 'object') return;
      showXpNotification(data.xp ?? 0, data.reason ?? '', data.levelUp ?? null);
    });

    socketRef.current = socket;
  };

  const getSocket = useCallback(() => socketRef.current, []);

  const logout = async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    disconnectSocket();

    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    } catch (error) {
      console.warn('Secure store cleanup failed:', error.message);
    }
  };

  const login = async ({ email, password }) => {
    setIsSubmitting(true);
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const response = await loginRequest(normalizedEmail, password);
      const nextToken = response?.data?.token || response?.data?.accessToken;
      const loginUser = response?.data?.user || null;

      if (!nextToken) {
        throw new Error('No token returned by server');
      }

      setAuthToken(nextToken);

      let me = loginUser;
      try {
        const meResponse = await meRequest();
        me = meResponse.data;
      } catch (meErr) {
        console.warn('Login: /me failed, using login payload user:', meErr?.message);
        if (!me) {
          throw meErr;
        }
      }

      await SecureStore.setItemAsync('token', nextToken);
      await SecureStore.setItemAsync('user', JSON.stringify(me));

      setToken(nextToken);
      setUser(me);
      connectSocket(nextToken, me);
      return { ok: true };
    } catch (error) {
      const status = error?.response?.status;
      const msg = extractErrorMessage(error, 'Login failed');
      if (status === 400 && msg === 'Invalid credentials') {
        return {
          ok: false,
          message:
            'Email or password is wrong. If you sign in with Google on web, use Forgot password here first to set a password.',
        };
      }
      return { ok: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const register = async ({ firstName, lastName, email, password, role }) => {
    setIsSubmitting(true);
    try {
      const response = await registerRequest({
        firstName,
        lastName,
        email,
        password,
        role: role || 'athlete',
      });

      const nextToken = response?.data?.token || null;
      const fallbackUser = response?.data?.user || null;

      if (!nextToken) {
        return { ok: false, message: 'Registration succeeded but no token returned' };
      }

      setAuthToken(nextToken);

      let me = fallbackUser;
      try {
        const meResponse = await meRequest();
        me = meResponse.data;
      } catch (_error) {
        if (!me) {
          throw _error;
        }
      }

      await SecureStore.setItemAsync('token', nextToken);
      await SecureStore.setItemAsync('user', JSON.stringify(me));

      setToken(nextToken);
      setUser(me);
      connectSocket(nextToken, me);

      return { ok: true };
    } catch (error) {
      return { ok: false, message: extractErrorMessage(error, 'Registration failed') };
    } finally {
      setIsSubmitting(false);
    }
  };

  const forgotPassword = async (email) => {
    setIsSubmitting(true);
    try {
      const response = await forgotPasswordRequest(email);
      return {
        ok: true,
        message: response?.data?.msg || 'If that email exists, a reset link has been sent.',
        resetUrl: response?.data?.resetUrl || null,
      };
    } catch (error) {
      return { ok: false, message: extractErrorMessage(error, 'Could not request password reset') };
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUser = await SecureStore.getItemAsync('user');

        if (!storedToken) {
          return;
        }

        setAuthToken(storedToken);

        try {
          const meResponse = await meRequest();
          const me = meResponse.data;
          setToken(storedToken);
          setUser(me);
          await SecureStore.setItemAsync('user', JSON.stringify(me));
          connectSocket(storedToken, me);
        } catch (_error) {
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setToken(storedToken);
            setUser(parsedUser);
            connectSocket(storedToken, parsedUser);
          } else {
            await logout();
          }
        }
      } catch (error) {
        console.warn('Auth bootstrap failed:', error.message);
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();

    return () => {
      disconnectSocket();
    };
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      getSocket,
      socketConnected,
      isBootstrapping,
      isSubmitting,
      login,
      register,
      forgotPassword,
      logout,
      refreshMe: async () => {
        if (!token) {
          return null;
        }
        const prevLevel = user?.level;
        const response = await meRequest();
        const me = response.data;
        if (prevLevel != null && me?.level != null && Number(me.level) > Number(prevLevel)) {
          showXpNotification(0, '', { oldLevel: Number(prevLevel), newLevel: Number(me.level) });
        }
        setUser(me);
        await SecureStore.setItemAsync('user', JSON.stringify(me));
        return me;
      },
    }),
    [token, user, getSocket, socketConnected, isBootstrapping, isSubmitting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
