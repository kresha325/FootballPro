/**
 * LiveKit RN globals. Safe to call in Expo Go — returns false if native module missing.
 */
let cached = null;

export function ensureLiveKitNative() {
  if (cached !== null) return cached;

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const livekitRn = require('@livekit/react-native');
    if (typeof livekitRn.registerGlobals === 'function') {
      livekitRn.registerGlobals();
    }
    cached = true;
  } catch (err) {
    console.warn('[livekit] Native SDK unavailable — using WebView fallback:', err?.message || err);
    cached = false;
  }

  return cached;
}

export function isLiveKitNativeAvailable() {
  return ensureLiveKitNative();
}
