import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

/**
 * Camera + microphone permissions for Go Live / calls.
 * Mic moved off expo-image-picker in newer SDKs — use expo-audio when present.
 */
export async function requestCameraAndMicrophonePermissions() {
  const camera = await ImagePicker.requestCameraPermissionsAsync();

  let microphone = { granted: false, status: 'undetermined' };
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const ExpoAudio = require('expo-audio');
    if (typeof ExpoAudio.requestRecordingPermissionsAsync === 'function') {
      microphone = await ExpoAudio.requestRecordingPermissionsAsync();
    } else if (typeof ExpoAudio.getRecordingPermissionsAsync === 'function') {
      microphone = await ExpoAudio.getRecordingPermissionsAsync();
    }
  } catch (_err) {
    if (typeof ImagePicker.requestMicrophonePermissionsAsync === 'function') {
      microphone = await ImagePicker.requestMicrophonePermissionsAsync();
    } else {
      // Last resort: do not silently grant — caller should block Go Live
      microphone = { granted: false, status: 'unavailable' };
    }
  }

  return { camera, microphone };
}

function isPhotoAccessOk(result) {
  if (!result) return false;
  if (result.granted || result.status === 'granted') return true;
  // iOS limited library access is enough to pick photos
  if (result.accessPrivileges === 'limited') return true;
  return false;
}

/**
 * Ensure we can open the photo library / system photo picker.
 * Android 13+ system picker typically needs no permission.
 * Returns true when the caller may launch the image library.
 */
export async function ensureMediaLibraryPermission() {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    return { ok: true, canAskAgain: true };
  }

  let result = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!isPhotoAccessOk(result)) {
    result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }

  if (isPhotoAccessOk(result)) {
    return { ok: true, canAskAgain: true, result };
  }

  return {
    ok: false,
    canAskAgain: result?.canAskAgain !== false,
    result,
  };
}

/** Prompt user to open Settings when photo access was denied. */
export function alertMediaLibraryDenied() {
  const { Alert } = require('react-native');
  Alert.alert(
    'Leja e galerisë',
    'Lejo aksesin te fotot që të bashkëngjitësh logo të sponsorit. Mund ta aktivizosh te Cilësimet.',
    [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Hap Cilësimet',
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ]
  );
}
