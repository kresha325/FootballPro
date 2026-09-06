import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { handlePushOpen } from '../notifications/handlePushOpen';
import {
  registerPushWithBackend,
  syncPushTokenToBackend,
} from '../notifications/push';

export default function PushNotificationManager() {
  const { token, user } = useAuth();
  const handledResponseId = useRef(null);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    let cancelled = false;

    (async () => {
      try {
        await registerPushWithBackend();
      } catch (error) {
        console.warn('push register failed:', error?.message || error);
      }
    })();

    const tokenSub = Notifications.addPushTokenListener((devicePushToken) => {
      const next = devicePushToken?.data;
      if (!next) return;
      syncPushTokenToBackend(next).catch((error) => {
        console.warn('push token refresh failed:', error?.message || error);
      });
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
      tokenSub.remove();
      responseSub.remove();
    };
  }, [token, user?.id]);

  return null;
}
