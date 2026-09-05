import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { WEB_APP_URL } from '../config/constants';
import {
  endVideoCallRequest,
  extractErrorMessage,
  profileByIdRequest,
  startVideoCallRequest,
} from '../api/client';
import NativeCallRoom from '../livekit/NativeCallRoom';
import { ensureLiveKitNative } from '../livekit/register';

function WebOutgoingFallback({ uri, injectedBefore, navigation }) {
  return (
    <WebView
      style={styles.webview}
      source={{ uri }}
      injectedJavaScriptBeforeContentLoaded={injectedBefore}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      mixedContentMode="always"
      mediaCapturePermissionGrantType="grant"
      onError={() => Alert.alert('Gabim', 'Nuk u ngarkua faqja e thirrjes. Kontrollo WEB_APP_URL dhe rrjetin.')}
      onHttpError={() => Alert.alert('Gabim HTTP', 'Serveri i web-it u përgjigj me gabim.')}
    />
  );
}

export default function OutgoingCallScreen({ route, navigation }) {
  const { targetUserId, audioOnly = false } = route.params || {};
  const { token, user, getSocket, socketConnected } = useAuth();
  const [forceWeb, setForceWeb] = useState(false);
  const [phase, setPhase] = useState('boot'); // boot | ringing | connected | error
  const [callId, setCallId] = useState(null);
  const [peerLabel, setPeerLabel] = useState('');
  const [error, setError] = useState('');
  const endingRef = useRef(false);

  const useNative = ensureLiveKitNative() && !forceWeb;

  const uri = useMemo(() => {
    if (!WEB_APP_URL || !targetUserId) return '';
    const base = WEB_APP_URL.replace(/\/$/, '');
    return `${base}/embed-call?targetUserId=${encodeURIComponent(String(targetUserId))}&audioOnly=${audioOnly ? '1' : '0'}`;
  }, [targetUserId, audioOnly]);

  const injectedBefore = useMemo(() => {
    const t = token ? JSON.stringify(token) : '""';
    return `(function(){try{localStorage.setItem('token',${t});}catch(e){}})();true;`;
  }, [token]);

  const hangUp = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      const socket = getSocket?.();
      if (socket && targetUserId) {
        socket.emit('call:end', { to: Number(targetUserId) || targetUserId });
      }
      if (callId) {
        await endVideoCallRequest(callId).catch(() => {});
      }
    } finally {
      navigation.goBack();
    }
  }, [callId, getSocket, navigation, targetUserId]);

  useEffect(() => {
    if (!useNative || !targetUserId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        setPhase('boot');
        try {
          const res = await profileByIdRequest(targetUserId);
          const p = res?.data;
          if (!cancelled) {
            setPeerLabel(`${p?.firstName || ''} ${p?.lastName || ''}`.trim() || `User ${targetUserId}`);
          }
        } catch {
          if (!cancelled) setPeerLabel(`User ${targetUserId}`);
        }

        const socket = getSocket?.();
        if (!socket || !socketConnected) {
          throw new Error('Socket nuk është i lidhur. Provo përsëri.');
        }

        const startRes = await startVideoCallRequest(targetUserId);
        const createdCallId = startRes?.data?.id;
        if (!createdCallId) throw new Error('Nuk u krijua callId');
        if (cancelled) return;

        setCallId(createdCallId);
        setPhase('ringing');

        socket.emit('call:offer', {
          to: Number(targetUserId) || targetUserId,
          from: user?.id,
          callerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          offer: { type: 'livekit-invite' },
          callId: createdCallId,
          audioOnly: !!audioOnly,
        });
      } catch (err) {
        if (cancelled) return;
        setError(extractErrorMessage(err, 'Thirrja nuk u nis'));
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useNative, targetUserId, getSocket, socketConnected, user, audioOnly]);

  useEffect(() => {
    if (!useNative || !callId) return undefined;
    const socket = getSocket?.();
    if (!socket) return undefined;

    const onAnswer = ({ answer, callId: answeredId }) => {
      const active = answeredId || callId;
      if (String(active) !== String(callId)) return;
      if (answer?.type === 'livekit-accepted') {
        setPhase('connected');
      }
    };
    const onReject = () => {
      Alert.alert('Thirrja', 'Thirrja u refuzua.');
      hangUp();
    };
    const onEnd = () => {
      hangUp();
    };

    socket.on('call:answered', onAnswer);
    socket.on('call:rejected', onReject);
    socket.on('call:ended', onEnd);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:answered', onAnswer);
      socket.off('call:rejected', onReject);
      socket.off('call:ended', onEnd);
      socket.off('call:end', onEnd);
    };
  }, [useNative, callId, getSocket, hangUp]);

  if (!targetUserId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Mungon përdoruesi i synuar.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!useNative) {
    if (!WEB_APP_URL) {
      return (
        <View style={styles.centered}>
          <Text style={styles.title}>Thirrjet nga aplikacioni</Text>
          <Text style={styles.body}>
            LiveKit native nuk është i disponueshëm (Expo Go). Vendos WEB_APP_URL ose ndërto me EAS Dev Client.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Kthehu</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <WebOutgoingFallback uri={uri} injectedBefore={injectedBefore} navigation={navigation} />;
  }

  if (phase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setForceWeb(true)}>
          <Text style={styles.btnText}>Provo me WebView</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'boot') {
    return (
      <View style={styles.centeredDark}>
        <ActivityIndicator size="large" color="#5eead4" />
        <Text style={styles.ringTitle}>{peerLabel || 'Duke telefonuar…'}</Text>
        <Text style={styles.ringHint}>Duke nisur…</Text>
        <TouchableOpacity style={styles.hangup} onPress={hangUp}>
          <Text style={styles.hangupText}>Anulo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Join LiveKit while ringing (same as web): publish early so callee hears/sees on accept.
  return (
    <View style={styles.container}>
      {phase === 'ringing' ? (
        <View style={styles.ringBanner}>
          <Text style={styles.ringBannerText}>Po bie te {peerLabel || 'përdoruesi'}…</Text>
        </View>
      ) : null}
      <NativeCallRoom
        callId={callId}
        audioOnly={!!audioOnly}
        participantName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
        peerLabel={peerLabel}
        onNativeUnavailable={() => setForceWeb(true)}
        onFatalError={(msg) => {
          setError(msg);
          setPhase('error');
        }}
        onDisconnected={hangUp}
        onHangUp={hangUp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f8fafc' },
  centeredDark: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 20 },
  error: { color: '#b91c1c', marginBottom: 16, textAlign: 'center', fontWeight: '700' },
  btn: { backgroundColor: '#0f766e', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnSecondary: { backgroundColor: '#475569' },
  btnText: { color: '#fff', fontWeight: '700' },
  ringTitle: { marginTop: 16, color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  ringHint: { marginTop: 8, color: '#94a3b8', marginBottom: 28 },
  ringBanner: {
    backgroundColor: '#0f766e',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ringBannerText: { color: '#ecfdf5', fontWeight: '700', textAlign: 'center' },
  hangup: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  hangupText: { color: '#fff', fontWeight: '800' },
});
