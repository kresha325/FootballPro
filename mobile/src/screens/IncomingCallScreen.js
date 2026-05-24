import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { WEB_APP_URL } from '../config/constants';
import { consumePendingIncomingCall } from '../utils/incomingCallPayload';

export default function IncomingCallScreen({ navigation }) {
  const { token } = useAuth();
  const payload = useMemo(() => consumePendingIncomingCall(), []);

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

  if (!WEB_APP_URL) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Thirrje hyrëse</Text>
        <Text style={styles.body}>
          Vendos <Text style={styles.mono}>WEB_APP_URL</Text> në app.config.js (URL e frontend-it web) që WebView të përdorë
          të njëjtën logjikë WebRTC si në browser.
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

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 20 },
  mono: { fontFamily: 'Courier', fontSize: 13, color: '#0f766e' },
  error: { color: '#b91c1c', marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: '#0f766e', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
