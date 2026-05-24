import { preferLiveKitBroadcast } from './device';

/** Opsione video për LiveKit — mobile preferon kamerën e pasme (futboll). */
export function getLiveVideoCaptureOptions() {
  if (preferLiveKitBroadcast()) {
    return {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: { ideal: 'environment' },
    };
  }
  return true;
}

/**
 * Ndryshon kamerën front ↔ back për LocalVideoTrack të LiveKit.
 * Përdor enumerateDevices (më i besueshëm në WebView mobile) me fallback facingMode.
 */
export async function switchLocalVideoCamera(videoTrack, facingRef) {
  if (!videoTrack || videoTrack.kind !== 'video') {
    throw new Error('No video track');
  }

  let devices = [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter((d) => d.kind === 'videoinput' && d.deviceId);
  } catch (_e) {
    /* fallback below */
  }

  const currentId = videoTrack.mediaStreamTrack?.getSettings?.()?.deviceId;

  if (devices.length >= 2) {
    const idx = Math.max(0, devices.findIndex((d) => d.deviceId === currentId));
    const next = devices[(idx + 1) % devices.length];
    await videoTrack.restartTrack({ deviceId: { exact: next.deviceId } });
    const label = (next.label || '').toLowerCase();
    if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
      facingRef.current = 'environment';
    } else if (label.includes('front') || label.includes('user')) {
      facingRef.current = 'user';
    }
    return facingRef.current;
  }

  const nextFacing = facingRef.current === 'environment' ? 'user' : 'environment';
  await videoTrack.restartTrack({ facingMode: nextFacing });
  facingRef.current = nextFacing;
  return nextFacing;
}

export function isFrontCamera(facingRef) {
  return facingRef?.current !== 'environment';
}
