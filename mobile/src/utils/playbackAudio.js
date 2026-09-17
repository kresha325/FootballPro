import { Audio } from 'expo-av';

let configured = false;

/**
 * iOS silent switch mutes Video/AVPlayer unless playsInSilentModeIOS is on.
 * Call once at app start so feed / Videos / chat clips have audible playback.
 */
export async function configurePlaybackAudio() {
  if (configured) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckOthers: true,
      playThroughEarpieceAndroid: false,
    });
    configured = true;
  } catch (err) {
    console.warn('configurePlaybackAudio failed:', err?.message || err);
  }
}
