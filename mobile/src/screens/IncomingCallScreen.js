import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { WEB_APP_URL } from '../config/constants';
import { consumePendingIncomingCall } from '../utils/incomingCallPayload';
import { endVideoCallRequest } from '../api/client';
import NativeCallRoom from '../livekit/NativeCallRoom';
import { ensureLiveKitNative } from '../livekit/register';

export default function IncomingCallScreen({ navigation }) {
  const { token, user, getSocket } = useAuth();
  const payload = useMemo(() => consumePendingIncomingCall(), []);
  const [forceWeb, setForceWeb] = useState(false);
  const [answered, setAnswered] = useState(false);
  const endingRef = useRef(false);

  const useNative = ensureLiveKitNative() && !forceWeb;
  const callId = payload?.callId;
  const audioOnly = !!payload?.audioOnly;
  const peerLabel = payload?.callerName || 'Caller';

  const uri = useMemo(() => {
    if (!WEB_APP_URL) return '';
    const base = WEB_APP_URL.replace(/\/$/, '');
    return `${base}/embed-incoming-call`;
  }, []);

  const injectedBefore = useMemo(() => {
    const t = token ? JSON.stringify(token) : '""';
    const incoming = payload
      ? JSON.stringify({
          from: payload.from,
          callerName: payload.callerName,
          offer: payload.offer,
          callId: payload.callId,
          audioOnly: !!payload.audioOnly,
        })
      : 'null';
    return `(function(){try{localStorage.setItem('token',${t});sessionStorage.setItem('fp_embed_incoming_call',${incoming});}catch(e){}})();true;`;
  }, [token, payload]);

  const hangUp = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      const socket = getSocket?.();
      if (socket && payload?.from) {
        socket.emit('call:end', { to: payload.from });
      }
      if (callId) {
        await endVideoCallRequest(callId).catch(() => {});
      }
    } finally {
      navigation.goBack();
    }
  }, [callId, getSocket, navigation, payload?.from]);

  useEffect(() => {
    if (!useNative || !payload?.from || !callId || answered) return;
    const socket = getSocket?.();
    if (!socket) {
      setForceWeb(true);
      return;
    }
    socket.emit('call:answer', {
      to: payload.from,
      answer: { type: 'livekit-accepted' },
      callId,
    });
    setAnswered(true);
  }, [useNative, payload, callId, answered, getSocket]);

  useEffect(() => {
    if (!useNative) return undefined;
    const socket = getSocket?.();
    if (!socket) return undefined;
    const onEnd = () => hangUp();
    socket.on('call:ended', onEnd);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:ended', onEnd);
      socket.off('call:end', onEnd);
    };
  }, [useNative, getSocket, hangUp]);

  if (!payload?.from || (!payload?.offer && !payload?.callId)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Të dhënat e thirrjes mungojnë ose skadojnë.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Mbyll</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!useNative) {
    if (!WEB_APP_URL) {
      return (
        <View style={styles.centered}>
          <Text style={styles.title}>Thirrje hyrëse</Text>
          <Text style={styles.body}>
            LiveKit native nuk është i disponueshëm. Vendos WEB_APP_URL ose ndërto me EAS Dev Client.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Kthehu</Text>
          </TouchableOpacity>
        </View>
      );
    }
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
        onError={() => Alert.alert('Gabim', 'Nuk u ngarkua faqja e thirrjes hyrëse.')}
        onHttpError={() => Alert.alert('Gabim HTTP', 'Kontrollo WEB_APP_URL dhe që frontend-i është i deploy-uar.')}
      />
    );
  }

  if (!callId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Mungon callId për LiveKit. Provo WebView.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setForceWeb(true)}>
          <Text style={styles.btnText}>Hap me WebView</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NativeCallRoom
      callId={callId}
      audioOnly={audioOnly}
      participantName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
      peerLabel={peerLabel}
      onNativeUnavailable={() => setForceWeb(true)}
      onFatalError={() => setForceWeb(true)}
      onDisconnected={hangUp}
      onHangUp={hangUp}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 20 },
  error: { color: '#b91c1c', marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: '#0f766e', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
