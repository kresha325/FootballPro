import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { handlePushOpen } from '../notifications/handlePushOpen';
import {
  getExpoPushTokenString,
  registerPushWithBackend,
  syncPushTokenToBackend,
} from '../notifications/push';

export default function PushNotificationManager() {
  const { token, user } = useAuth();
  const handledResponseId = useRef(null);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    let cancelled = false;

    const registerTimer = setTimeout(() => {
      if (cancelled) return;
      registerPushWithBackend().catch((error) => {
        console.warn('push register failed:', error?.message || error);
      });
    }, 2000);

    const tokenSub = Notifications.addPushTokenListener(() => {
      getExpoPushTokenString()
        .then((next) => (next ? syncPushTokenToBackend(next) : null))
        .catch((error) => {
          console.warn('push token refresh failed:', error?.message || error);
        });
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      DeviceEventEmitter.emit('notifications-refresh');
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const responseId = response?.notification?.request?.identifier;
      if (responseId && handledResponseId.current === responseId) return;
      handledResponseId.current = responseId || `tap-${Date.now()}`;
      const data = response?.notification?.request?.content?.data || {};
      handlePushOpen(data).catch(() => {});
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        const responseId = response?.notification?.request?.identifier;
        if (responseId && handledResponseId.current === responseId) return;
        handledResponseId.current = responseId || `cold-${Date.now()}`;
        const data = response?.notification?.request?.content?.data || {};
        return handlePushOpen(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(registerTimer);
      tokenSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [token, user?.id]);

  return null;
}
