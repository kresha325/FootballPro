import * as ImagePicker from 'expo-image-picker';

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
