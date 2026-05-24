import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { WebView } from 'react-native-webview';
import { absoluteBackendUrl, BACKEND_URL } from '../config/constants';
import { extractErrorMessage, getStreamRequest, joinStreamRequest, leaveStreamRequest } from '../api/client';
import { buildYoutubeChannelLiveEmbedUrl } from '../utils/youtubeLiveEmbed';

export default function LiveViewerScreen({ route }) {
  const streamId = route?.params?.streamId;
  const frontendBase = BACKEND_URL.replace(/\/api\/?$/, '');
  const [uri, setUri] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!streamId) {
        setError('Missing stream id.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      setUri(null);
      try {
        const res = await getStreamRequest(streamId);
        const data = res?.data;
        if (cancelled) return;
        if (!data?.isLive) {
          const rec = absoluteBackendUrl(data?.videoUrl) || data?.videoUrl;
          if (rec) {
            setRecordingUri(rec);
            setLoading(false);
            return;
          }
          setError('This stream is not live right now.');
          setLoading(false);
          return;
        }
        try {
          await joinStreamRequest(streamId);
        } catch (_joinErr) {
          /* viewer count best-effort */
        }
        if (data.youtubeChannelId) {
          setUri(buildYoutubeChannelLiveEmbedUrl(data.youtubeChannelId));
        } else {
          setUri(`${frontendBase}/live/${streamId}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Could not load stream'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (streamId) {
        leaveStreamRequest(streamId).catch(() => {});
      }
    };
  }, [streamId, frontendBase]);

  if (!streamId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing stream id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error && !recordingUri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (recordingUri) {
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

  if (!uri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not open player.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        )}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontWeight: '700', padding: 16, textAlign: 'center' },
});
