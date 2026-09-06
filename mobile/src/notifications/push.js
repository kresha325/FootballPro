import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { registerPushTokenRequest } from '../api/client';

const PREF_KEY = 'pushNotificationsEnabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getEasProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EAS_PROJECT_ID ||
    '3352bbbe-2f86-4665-9a67-e0499d1051bc'
  );
}

export async function getPushPreference() {
  try {
    const value = await SecureStore.getItemAsync(PREF_KEY);
    if (value == null) return true;
    return value === '1';
  } catch {
    return true;
  }
}

export async function setPushPreference(enabled) {
  await SecureStore.setItemAsync(PREF_KEY, enabled ? '1' : '0');
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'XTalenti',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f766e',
  });
}

export async function ensurePushPermissions() {
  if (!Device.isDevice) {
    return { granted: false, status: 'unavailable', reason: 'simulator' };
  }

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return { granted: status === 'granted', status };
}

export async function getExpoPushTokenString() {
  const projectId = getEasProjectId();
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return result?.data || null;
}

export async function syncPushTokenToBackend(token) {
  if (!token) return;
  await registerPushTokenRequest(token, 'mobile');
}

export async function clearPushTokenFromBackend() {
  try {
    await registerPushTokenRequest(null, 'mobile');
  } catch (error) {
    console.warn('clear push token failed:', error?.message || error);
  }
}

/** Register permissions + Expo token + POST to API. Returns token or null. */
export async function registerPushWithBackend() {
  const pref = await getPushPreference();
  if (!pref) return null;

  const { granted } = await ensurePushPermissions();
  if (!granted) return null;

  const token = await getExpoPushTokenString();
  if (!token) return null;

  await syncPushTokenToBackend(token);
  return token;
}

export async function enablePushNotifications() {
  await setPushPreference(true);
  return registerPushWithBackend();
}

export async function disablePushNotifications() {
  await setPushPreference(false);
  await clearPushTokenFromBackend();
}

export async function getNotificationPermissionGranted() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
