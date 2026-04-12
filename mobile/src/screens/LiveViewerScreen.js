import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BACKEND_URL } from '../config/constants';

export default function LiveViewerScreen({ route }) {
  const streamId = route?.params?.streamId;
  const frontendBase = BACKEND_URL.replace(/\/api\/?$/, '');

  if (!streamId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing stream id.</Text>
      </View>
    );
  }

  const uri = `${frontendBase}/live/${streamId}`;

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
  errorText: { color: '#ef4444', fontWeight: '700' },
});
