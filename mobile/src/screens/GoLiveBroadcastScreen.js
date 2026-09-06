import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { WEB_APP_URL } from '../config/constants';
import { buildQueryString } from '../utils/queryString';
import { ensureLiveKitNative } from '../livekit/register';
import NativeGoLiveBroadcaster from '../livekit/NativeGoLiveBroadcaster';
import { endStreamRequest } from '../api/client';

export default function GoLiveBroadcastScreen({ route, navigation }) {
  const { streamId, title = '', description = '', confirmed = false } = route.params || {};
  const { token } = useAuth();
  const [mode, setMode] = useState(() => (ensureLiveKitNative() ? 'native' : 'web'));
  const endedRef = React.useRef(false);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (endedRef.current || !streamId) return;
      endedRef.current = true;
      endStreamRequest(streamId).catch(() => {});
    });
    return unsub;
  }, [navigation, streamId]);

  const uri = useMemo(() => {
    if (!WEB_APP_URL || !streamId) return '';
    const base = WEB_APP_URL.replace(/\/$/, '');
    const q = buildQueryString({
      streamId: String(streamId),
      title: title || 'Live',
      description: description || '',
      ...(confirmed ? { confirmed: '1' } : {}),
      livekit: '1',
    });
    return `${base}/embed-go-live?${q}`;
  }, [streamId, title, description, confirmed]);

  const onWebError = useCallback(
    (event) => {
      const desc = event?.nativeEvent?.description || 'load failed';
      Alert.alert(
        'Gabim',
        `Nuk u ngarkua transmetimi.\n\nURL: ${uri}\n\n${desc}\n\nKontrollo që xtalenti.com është online.`
      );
    },
    [uri]
  );

  const onHttpError = useCallback(
    (event) => {
      const status = event?.nativeEvent?.statusCode;
      Alert.alert('Gabim HTTP', `Status ${status || '?'}\n${uri}`);
    },
    [uri]
  );

  const injectedBefore = useMemo(() => {
    const t = token ? JSON.stringify(token) : '""';
    return `(function(){try{localStorage.setItem('token',${t});}catch(e){}})();true;`;
  }, [token]);

  const onWebMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'goLiveEnded') {
          navigation.goBack();
        }
        if (data.type === 'goLiveError') {
          Alert.alert('Go Live', data.message || 'Transmetimi dështoi');
        }
        if (data.type === 'openLiveViewer' && data.streamId) {
          navigation.navigate('LiveViewer', {
            streamId: data.streamId,
            fromBroadcast: true,
          });
        }
      } catch (_e) {
        /* ignore */
      }
    },
    [navigation]
  );

  const openWebFallback = useCallback(() => {
    if (!WEB_APP_URL) {
      Alert.alert('Go Live', 'WEB_APP_URL mungon — nuk mund të hapet WebView fallback.');
      return;
    }
    setMode('web');
  }, []);

  if (!streamId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Mungon stream id.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'native') {
    return (
      <NativeGoLiveBroadcaster
        streamId={streamId}
        title={title}
        onNativeUnavailable={openWebFallback}
        onFatalError={(msg) => Alert.alert('Go Live', msg)}
        onEnded={() => {
          endedRef.current = true;
          navigation.goBack();
        }}
      />
    );
  }

  if (!WEB_APP_URL) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Go Live</Text>
        <Text style={styles.body}>
          Vendos WEB_APP_URL në app.json (frontend, p.sh. https://xtalenti.com).
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
      mediaCapturePermissionGrantType="grant"
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      mixedContentMode="always"
      originWhitelist={['*']}
      onMessage={onWebMessage}
      onError={onWebError}
      onHttpError={onHttpError}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12 },
  body: { fontSize: 15, color: '#cbd5e1', lineHeight: 22, marginBottom: 20 },
  error: { color: '#fca5a5', marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: '#0f766e', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
