import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Track } from 'livekit-client';
import { createLiveKitTokenRequest, extractErrorMessage } from '../api/client';
import { ensureLiveKitNative } from './register';

function RemoteVideos() {
  // Lazy-loaded hooks must run only after native registerGlobals succeeded.
  // eslint-disable-next-line global-require
  const { useTracks, VideoTrack, isTrackReference } = require('@livekit/react-native');
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const remote = tracks.filter((t) => isTrackReference(t) && !t.participant.isLocal);

  if (!remote.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Duke pritur videon e streamer-it…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {remote.map((trackRef) => (
        <VideoTrack
          key={`${trackRef.participant.identity}-${trackRef.publication?.trackSid || 'v'}`}
          style={styles.video}
          trackRef={trackRef}
          objectFit="contain"
        />
      ))}
    </View>
  );
}

/**
 * Subscribe-only LiveKit room for stream-{id}.
 * Calls onNativeUnavailable so parent can fall back to WebView (Expo Go / missing native).
 */
export default function NativeLiveViewer({ streamId, onNativeUnavailable, onFatalError }) {
  const [bootError, setBootError] = useState('');
  const [creds, setCreds] = useState(null);
  const [LiveKitRoomComp, setLiveKitRoomComp] = useState(null);

  const roomName = useMemo(() => `stream-${streamId}`, [streamId]);

  const handleDisconnected = useCallback(() => {
    /* room teardown handled by LiveKitRoom unmount */
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!ensureLiveKitNative()) {
        onNativeUnavailable?.();
        return;
      }

      try {
        // eslint-disable-next-line global-require
        const { LiveKitRoom } = require('@livekit/react-native');
        if (cancelled) return;
        setLiveKitRoomComp(() => LiveKitRoom);

        const tokenRes = await createLiveKitTokenRequest({
          roomName,
          canPublish: false,
          canSubscribe: true,
          canPublishData: false,
        });
        const wsUrl = tokenRes?.data?.wsUrl;
        const token = tokenRes?.data?.token;
        if (!wsUrl || !token) {
          throw new Error('Token LiveKit i pavlefshëm');
        }
        if (cancelled) return;
        setCreds({ wsUrl, token });
      } catch (err) {
        if (cancelled) return;
        const message = extractErrorMessage(err, 'Nuk u lidh me LiveKit');
        if (/Native module|Expo Go|Cannot find module|Invariant Violation/i.test(String(err?.message || err))) {
          onNativeUnavailable?.();
          return;
        }
        setBootError(message);
        onFatalError?.(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomName, onNativeUnavailable, onFatalError]);

  if (bootError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{bootError}</Text>
      </View>
    );
  }

  if (!LiveKitRoomComp || !creds) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Duke u lidhur me LiveKit…</Text>
      </View>
    );
  }

  const LiveKitRoom = LiveKitRoomComp;
  return (
    <LiveKitRoom
      serverUrl={creds.wsUrl}
      token={creds.token}
      connect
      audio={false}
      video={false}
      onDisconnected={handleDisconnected}
      style={styles.container}
    >
      <RemoteVideos />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  loadingText: { marginTop: 12, color: '#94a3b8' },
  errorText: { color: '#ef4444', fontWeight: '700', textAlign: 'center' },
});
