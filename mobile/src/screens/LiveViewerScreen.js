import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BACKEND_URL } from '../config/constants';
import { extractErrorMessage, getStreamRequest, joinStreamRequest, leaveStreamRequest } from '../api/client';

function youtubeLiveEmbedUri(channelId) {
  const q = new URLSearchParams({
    channel: channelId,
    autoplay: '0',
    modestbranding: '1',
  });
  return `https://www.youtube.com/embed/live_stream?${q.toString()}`;
}

export default function LiveViewerScreen({ route }) {
  const streamId = route?.params?.streamId;
  const frontendBase = BACKEND_URL.replace(/\/api\/?$/, '');
  const [uri, setUri] = useState(null);
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
          setUri(youtubeLiveEmbedUri(data.youtubeChannelId));
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

  if (error || !uri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Could not open player.'}</Text>
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
