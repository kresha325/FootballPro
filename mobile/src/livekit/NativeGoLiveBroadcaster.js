import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Track } from 'livekit-client';
import * as ImagePicker from 'expo-image-picker';
import {
  createLiveKitTokenRequest,
  endStreamRequest,
  extractErrorMessage,
  heartbeatStreamRequest,
} from '../api/client';
import { ensureLiveKitNative } from './register';

function BroadcastStage({ muted, videoOff }) {
  // eslint-disable-next-line global-require
  const { useTracks, VideoTrack, isTrackReference, useLocalParticipant } = require('@livekit/react-native');
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const local = tracks.filter((t) => isTrackReference(t) && t.participant.isLocal);

  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
    localParticipant.setCameraEnabled(!videoOff).catch(() => {});
  }, [localParticipant, muted, videoOff]);

  if (videoOff || !local[0]) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>{videoOff ? 'Kamera fikur' : 'Duke ndezur kamerën…'}</Text>
        <Text style={styles.placeholderHint}>Je live — shikuesit mund të të shohin sapo kamera të jetë aktive.</Text>
      </View>
    );
  }

  return (
    <VideoTrack
      style={styles.localVideo}
      trackRef={local[0]}
      objectFit="cover"
      mirror
    />
  );
}

/** Count LiveKit remotes and push to API so feed/UI show real viewer count. */
function ViewerSync({ streamId, onViewersChange }) {
  // eslint-disable-next-line global-require
  const { useRemoteParticipants } = require('@livekit/react-native');
  const remotes = useRemoteParticipants();
  const viewers = remotes?.length ?? 0;

  useEffect(() => {
    onViewersChange?.(viewers);
  }, [viewers, onViewersChange]);

  useEffect(() => {
    if (!streamId) return undefined;
    const tick = () => {
      heartbeatStreamRequest(streamId, { viewers }).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, [streamId, viewers]);

  return null;
}

/**
 * Publish LiveKit room stream-{id} with local camera + mic.
 */
export default function NativeGoLiveBroadcaster({
  streamId,
  title,
  onNativeUnavailable,
  onFatalError,
  onEnded,
}) {
  const [bootError, setBootError] = useState('');
  const [creds, setCreds] = useState(null);
  const [LiveKitRoomComp, setLiveKitRoomComp] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [ending, setEnding] = useState(false);
  const [viewers, setViewers] = useState(0);

  const roomName = useMemo(() => `stream-${streamId}`, [streamId]);
  const onViewersChange = useCallback((n) => {
    setViewers(Math.max(0, Number(n) || 0));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!ensureLiveKitNative()) {
        onNativeUnavailable?.();
        return;
      }

      try {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        const mic = ImagePicker.requestMicrophonePermissionsAsync
          ? await ImagePicker.requestMicrophonePermissionsAsync()
          : { granted: true };
        if (!cam.granted || !mic.granted) {
          throw new Error('Lejo kamerën dhe mikrofonin në Settings për Go Live.');
        }

        // eslint-disable-next-line global-require
        const { LiveKitRoom } = require('@livekit/react-native');
        if (cancelled) return;
        setLiveKitRoomComp(() => LiveKitRoom);

        const tokenRes = await createLiveKitTokenRequest({
          roomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          metadata: { streamId, role: 'broadcaster' },
        });
        const wsUrl = tokenRes?.data?.wsUrl;
        const token = tokenRes?.data?.token;
        if (!wsUrl || !token) throw new Error('Token LiveKit i pavlefshëm');
        if (cancelled) return;
        setCreds({ wsUrl, token });
      } catch (err) {
        if (cancelled) return;
        const message = extractErrorMessage(err, 'Nuk u nis Go Live');
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
  }, [roomName, streamId, onNativeUnavailable, onFatalError]);

  const endLive = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      if (streamId) {
        await endStreamRequest(streamId).catch(() => {});
      }
    } finally {
      onEnded?.();
      setEnding(false);
    }
  }, [ending, streamId, onEnded]);

  if (bootError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{bootError}</Text>
        <TouchableOpacity style={styles.endBtn} onPress={endLive}>
          <Text style={styles.endBtnText}>Mbyll</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!LiveKitRoomComp || !creds) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Duke ndezur kamerën…</Text>
      </View>
    );
  }

  const LiveKitRoom = LiveKitRoomComp;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Go Live'}
        </Text>
        <Text style={styles.viewerCount}>{viewers} shikues</Text>
      </View>

      <LiveKitRoom
        serverUrl={creds.wsUrl}
        token={creds.token}
        connect
        audio
        video
        style={styles.flex}
      >
        <ViewerSync streamId={streamId} onViewersChange={onViewersChange} />
        <BroadcastStage muted={muted} videoOff={videoOff} />
      </LiveKitRoom>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, muted && styles.controlBtnActive]}
          onPress={() => setMuted((v) => !v)}
        >
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, videoOff && styles.controlBtnActive]}
          onPress={() => setVideoOff((v) => !v)}
        >
          <Text style={styles.controlText}>{videoOff ? 'Kamera' : 'Pa video'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={endLive} disabled={ending}>
          <Text style={styles.endBtnText}>{ending ? '…' : 'Ndalo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#0F172A',
  },
  livePill: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  livePillText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  headerTitle: { flex: 1, color: '#F8FAFC', fontWeight: '700', fontSize: 16 },
  viewerCount: { color: '#FCD34D', fontWeight: '700', fontSize: 13, marginLeft: 8 },
  localVideo: { flex: 1, width: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  placeholderTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  placeholderHint: { color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  loadingText: { marginTop: 12, color: '#94A3B8' },
  errorText: { color: '#EF4444', fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
  },
  controlBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    marginHorizontal: 5,
  },
  controlBtnActive: { backgroundColor: '#B45309' },
  controlText: { color: '#fff', fontWeight: '700' },
  endBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginHorizontal: 5,
  },
  endBtnText: { color: '#fff', fontWeight: '800' },
});
