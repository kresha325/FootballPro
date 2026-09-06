import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Track } from 'livekit-client';
import { createLiveKitTokenRequest, extractErrorMessage } from '../api/client';
import { requestCameraAndMicrophonePermissions } from '../utils/mediaPermissions';
import { ensureLiveKitNative } from './register';

function CallStage({ audioOnly, muted, videoOff, peerLabel }) {
  // eslint-disable-next-line global-require
  const { useTracks, VideoTrack, isTrackReference, useLocalParticipant } = require('@livekit/react-native');
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.filter((t) => isTrackReference(t) && !t.participant.isLocal);
  const local = tracks.filter((t) => isTrackReference(t) && t.participant.isLocal);

  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
    if (!audioOnly) {
      localParticipant.setCameraEnabled(!videoOff).catch(() => {});
    }
  }, [localParticipant, muted, videoOff, audioOnly]);

  return (
    <View style={styles.stage}>
      {remote.length ? (
        remote.map((trackRef) => (
          <VideoTrack
            key={`r-${trackRef.participant.identity}-${trackRef.publication?.trackSid || 'v'}`}
            style={styles.remoteVideo}
            trackRef={trackRef}
            objectFit="cover"
          />
        ))
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>{peerLabel || 'Duke pritur…'}</Text>
          <Text style={styles.placeholderHint}>
            {audioOnly ? 'Thirrje audio' : 'Duke pritur videon e tjetrit'}
          </Text>
        </View>
      )}

      {!audioOnly && !videoOff && local[0] ? (
        <View style={styles.localPip}>
          <VideoTrack style={styles.localVideo} trackRef={local[0]} objectFit="cover" mirror />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Publish+subscribe LiveKit room for call-{id}.
 */
export default function NativeCallRoom({
  callId,
  audioOnly = false,
  participantName,
  peerLabel,
  onNativeUnavailable,
  onFatalError,
  onDisconnected,
  onHangUp,
}) {
  const [bootError, setBootError] = useState('');
  const [creds, setCreds] = useState(null);
  const [LiveKitRoomComp, setLiveKitRoomComp] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!!audioOnly);

  const roomName = useMemo(() => `call-${callId}`, [callId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!ensureLiveKitNative()) {
        onNativeUnavailable?.();
        return;
      }

      try {
        const { camera: cam, microphone: mic } = await requestCameraAndMicrophonePermissions();
        if (!cam.granted || !mic.granted) {
          throw new Error('Lejo kamerën dhe mikrofonin në Settings për thirrje.');
        }

        // eslint-disable-next-line global-require
        const { LiveKitRoom } = require('@livekit/react-native');
        if (cancelled) return;
        setLiveKitRoomComp(() => LiveKitRoom);

        const tokenRes = await createLiveKitTokenRequest({
          roomName,
          participantName: participantName || undefined,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          metadata: { callId },
        });
        const wsUrl = tokenRes?.data?.wsUrl;
        const token = tokenRes?.data?.token;
        if (!wsUrl || !token) throw new Error('Token LiveKit i pavlefshëm');
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
  }, [roomName, participantName, callId, onNativeUnavailable, onFatalError]);

  const handleDisconnected = useCallback(() => {
    onDisconnected?.();
  }, [onDisconnected]);

  if (bootError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{bootError}</Text>
        <TouchableOpacity style={styles.hangup} onPress={onHangUp}>
          <Text style={styles.hangupText}>Mbyll</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!LiveKitRoomComp || !creds) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Duke u lidhur me thirrjen…</Text>
      </View>
    );
  }

  const LiveKitRoom = LiveKitRoomComp;
  return (
    <View style={styles.container}>
      <LiveKitRoom
        serverUrl={creds.wsUrl}
        token={creds.token}
        connect
        audio
        video={!audioOnly}
        onDisconnected={handleDisconnected}
        style={styles.flex}
      >
        <CallStage
          audioOnly={audioOnly}
          muted={muted}
          videoOff={videoOff}
          peerLabel={peerLabel}
        />
      </LiveKitRoom>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, muted && styles.controlBtnActive]}
          onPress={() => setMuted((v) => !v)}
        >
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        {!audioOnly ? (
          <TouchableOpacity
            style={[styles.controlBtn, videoOff && styles.controlBtnActive]}
            onPress={() => setVideoOff((v) => !v)}
          >
            <Text style={styles.controlText}>{videoOff ? 'Kamera' : 'Pa video'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.hangup} onPress={onHangUp}>
          <Text style={styles.hangupText}>Mbyll</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  stage: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localPip: {
    position: 'absolute',
    right: 12,
    top: 48,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#111',
  },
  localVideo: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  placeholderHint: { color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  loadingText: { marginTop: 12, color: '#94a3b8' },
  errorText: { color: '#ef4444', fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
  },
  controlBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  controlBtnActive: { backgroundColor: '#b45309' },
  controlText: { color: '#fff', fontWeight: '700' },
  hangup: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  hangupText: { color: '#fff', fontWeight: '800' },
});
