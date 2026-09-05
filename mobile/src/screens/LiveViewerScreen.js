import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { WebView } from 'react-native-webview';
import { absoluteBackendUrl, WEB_APP_URL } from '../config/constants';
import { extractErrorMessage, getStreamRequest, joinStreamRequest, leaveStreamRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buildYoutubeChannelLiveWatchUrl } from '../utils/youtubeLiveEmbed';
import NativeLiveViewer from '../livekit/NativeLiveViewer';
import { ensureLiveKitNative } from '../livekit/register';

export default function LiveViewerScreen({ route, navigation }) {
  const streamId = route?.params?.streamId;
  const fromBroadcast = !!route?.params?.fromBroadcast;
  const { token } = useAuth();
  const [mode, setMode] = useState('loading'); // loading | native | web | recording | error
  const [webUri, setWebUri] = useState('');
  const [recordingUri, setRecordingUri] = useState(null);
  const [error, setError] = useState('');
  const [youtubeChannelId, setYoutubeChannelId] = useState(null);
  const [streamTitle, setStreamTitle] = useState('');

  const injectedBefore = useMemo(() => {
    const t = token ? JSON.stringify(token) : '""';
    return `(function(){try{localStorage.setItem('token',${t});}catch(e){}})();true;`;
  }, [token]);

  const openWebFallback = useCallback(() => {
    if (!WEB_APP_URL) {
      setError('WEB_APP_URL nuk është konfiguruar në app.');
      setMode('error');
      return;
    }
    const base = WEB_APP_URL.replace(/\/$/, '');
    setWebUri(`${base}/live/${streamId}`);
    setMode('web');
  }, [streamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!streamId) {
        setError('Mungon ID e stream-it.');
        setMode('error');
        return;
      }
      setMode('loading');
      setError('');
      setWebUri('');
      setRecordingUri(null);
      setYoutubeChannelId(null);

      try {
        const res = await getStreamRequest(streamId);
        const data = res?.data;
        if (cancelled) return;

        setStreamTitle(data?.title || 'Live');
        setYoutubeChannelId(data?.youtubeChannelId || null);

        if (!data?.isLive) {
          const rec = absoluteBackendUrl(data?.videoUrl) || data?.videoUrl;
          if (rec) {
            setRecordingUri(rec);
            setMode('recording');
            return;
          }
          setError('Ky stream nuk është live tani.');
          setMode('error');
          return;
        }

        try {
          await joinStreamRequest(streamId);
        } catch (_joinErr) {
          /* viewer count best-effort */
        }

        if (ensureLiveKitNative()) {
          setMode('native');
        } else {
          openWebFallback();
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Nuk u ngarkua stream-i'));
          setMode('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (streamId) {
        leaveStreamRequest(streamId).catch(() => {});
      }
    };
  }, [streamId, openWebFallback]);

  if (!streamId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Mungon ID e stream-it.</Text>
      </View>
    );
  }

  if (mode === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Duke hapur stream…</Text>
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'recording' && recordingUri) {
    return (
      <View style={styles.container}>
        <Video
          source={{ uri: recordingUri }}
          style={StyleSheet.absoluteFillObject}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
        />
      </View>
    );
  }

  const chrome = (
    <>
      {fromBroadcast ? (
        <View style={styles.broadcastBanner}>
          <Text style={styles.broadcastBannerText}>
            Shikim si shikues — transmetimi vazhdon. Kthehu mbrapa për të vazhduar kamerën.
          </Text>
        </View>
      ) : null}
      {youtubeChannelId ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={3}>
            Nëse videoja YouTube është bosh, streameri duhet të nisë LIVE edhe në YouTube Studio për kanalin{' '}
            {youtubeChannelId}.
          </Text>
        </View>
      ) : null}
    </>
  );

  if (mode === 'native') {
    return (
      <View style={styles.container}>
        {chrome}
        {streamTitle ? (
          <View style={styles.titleBar}>
            <Text style={styles.titleText} numberOfLines={1}>
              {streamTitle}
            </Text>
            <Text style={styles.nativeBadge}>LiveKit</Text>
          </View>
        ) : null}
        <NativeLiveViewer
          streamId={streamId}
          onNativeUnavailable={openWebFallback}
          onFatalError={(msg) => {
            setError(msg);
            openWebFallback();
          }}
        />
        {youtubeChannelId ? (
          <TouchableOpacity
            style={styles.ytLink}
            onPress={() => {
              const url = buildYoutubeChannelLiveWatchUrl(youtubeChannelId);
              if (url) Linking.openURL(url).catch(() => {});
            }}
          >
            <Text style={styles.ytLinkText}>Hap në YouTube</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (mode === 'web' && webUri) {
    return (
      <View style={styles.container}>
        {chrome}
        <WebView
          style={styles.webview}
          source={{ uri: webUri }}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          onError={() =>
            Alert.alert(
              'Gabim',
              'Nuk u ngarkua player-i. Kontrollo internetin dhe frontend-in (xtalenti.com).'
            )
          }
          renderLoading={() => (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0f766e" />
            </View>
          )}
        />
        {youtubeChannelId ? (
          <TouchableOpacity
            style={styles.ytLink}
            onPress={() => {
              const url = buildYoutubeChannelLiveWatchUrl(youtubeChannelId);
              if (url) Linking.openURL(url).catch(() => {});
            }}
          >
            <Text style={styles.ytLinkText}>Hap në YouTube</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Nuk u hap player-i.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  loadingText: { marginTop: 12, color: '#64748b' },
  errorText: { color: '#ef4444', fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#0f766e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  banner: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  bannerText: { color: '#92400e', fontSize: 12, lineHeight: 17 },
  broadcastBanner: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#115e59',
  },
  broadcastBannerText: { color: '#ecfdf5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  titleText: { color: '#e2e8f0', fontWeight: '600', flex: 1, marginRight: 8 },
  nativeBadge: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ytLink: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  ytLinkText: { color: '#5eead4', fontWeight: '700' },
});
