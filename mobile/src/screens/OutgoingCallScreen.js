import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { WEB_APP_URL } from '../config/constants';

export default function OutgoingCallScreen({ route, navigation }) {
  const { targetUserId, audioOnly = false } = route.params || {};
  const { token } = useAuth();

  const uri = useMemo(() => {
    if (!WEB_APP_URL || !targetUserId) return '';
    const base = WEB_APP_URL.replace(/\/$/, '');
    return `${base}/embed-call?targetUserId=${encodeURIComponent(String(targetUserId))}&audioOnly=${audioOnly ? '1' : '0'}`;
  }, [targetUserId, audioOnly]);

  const injectedBefore = useMemo(() => {
    const t = token ? JSON.stringify(token) : '""';
    return `(function(){try{localStorage.setItem('token',${t});}catch(e){}})();true;`;
  }, [token]);

  if (!WEB_APP_URL) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Thirrjet nga aplikacioni</Text>
        <Text style={styles.body}>
          Për video / audio përmes WebView, vendos URL-në e frontend-it (Vite) në{' '}
          <Text style={styles.mono}>app.config.js</Text> → extra <Text style={styles.mono}>WEB_APP_URL</Text> ose
          variablin e mjedisit <Text style={styles.mono}>WEB_APP_URL</Text> gjatë build-it (shembull: https://app.jonsport.com).
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
