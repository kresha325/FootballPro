import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import {
  createStreamRequest,
  endStreamRequest,
  extractErrorMessage,
  startStreamRequest,
  streamsRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

const STREAMS_CACHE_KEY = 'mobile_streams_cache_v1';
const STREAMS_CACHE_TTL_MS = 3 * 60 * 1000;

export default function GoLiveScreen({ route, navigation }) {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [title, setTitle] = useState('Mobile Live Session');
  const [description, setDescription] = useState('Streaming from FootballPro mobile app');
  const [loading, setLoading] = useState(false);
  const [lastStream, setLastStream] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [myStreams, setMyStreams] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [cameraChecked, setCameraChecked] = useState(false);
  const focusStreamId = route?.params?.streamId;

  const openViewer = (streamId) => {
    navigation.navigate('LiveViewer', { streamId });
  };

  const loadStreams = async () => {
    setLoadingLists(true);
    setLoadError('');

    try {
      const cachedRaw = await AsyncStorage.getItem(STREAMS_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.ts && Date.now() - cached.ts < STREAMS_CACHE_TTL_MS) {
          setLiveStreams(Array.isArray(cached.live) ? cached.live : []);
          setMyStreams(Array.isArray(cached.mine) ? cached.mine : []);
        }
      }
    } catch (_e) {}

    try {
      const requests = [streamsRequest({ isLive: true, limit: 20 })];
      if (user?.id) {
        requests.push(streamsRequest({ userId: user.id, limit: 20 }));
      }
      const [liveRes, mineRes] = await Promise.all(requests);

      setLiveStreams(Array.isArray(liveRes.data) ? liveRes.data : []);
      setMyStreams(Array.isArray(mineRes?.data) ? mineRes.data : []);
      await AsyncStorage.setItem(
        STREAMS_CACHE_KEY,
        JSON.stringify({
          ts: Date.now(),
          live: Array.isArray(liveRes.data) ? liveRes.data : [],
          mine: Array.isArray(mineRes?.data) ? mineRes.data : [],
        })
      );
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Could not load streams'));
    } finally {
      setLoadingLists(false);
    }
  };

  const openCameraCheck = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    const micPerm = ImagePicker.requestMicrophonePermissionsAsync
      ? await ImagePicker.requestMicrophonePermissionsAsync()
      : { granted: true };

    if (!cameraPerm.granted || !micPerm.granted) {
      throw new Error('Camera and microphone permissions are required.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.5,
      allowsEditing: false,
      videoMaxDuration: 10,
    });

    if (result.canceled) {
      throw new Error('Camera was closed before starting live.');
    }

    setCameraChecked(true);
  };

  const onGoLive = async () => {
    setLoading(true);
    try {
      if (!cameraChecked) {
        await openCameraCheck();
      }

      const createRes = await createStreamRequest({ title, description, isPremium: false });
      const stream = createRes?.data;
      const streamId = stream?.id;

      if (!streamId) {
        throw new Error('Stream creation did not return an id');
      }

      const startRes = await startStreamRequest(streamId);
      setLastStream(startRes?.data?.stream || stream);
      await loadStreams();
      Alert.alert('Success', 'Stream created and marked as live.');
    } catch (err) {
      console.error('Go Live failed:', err?.response?.data || err?.message || err);
      Alert.alert('Go Live failed', extractErrorMessage(err, 'Could not start stream'));
    } finally {
      setLoading(false);
    }
  };

  const onEndStream = async (streamId) => {
    try {
      await endStreamRequest(streamId);
      if (lastStream?.id === streamId) {
        setLastStream((prev) => (prev ? { ...prev, isLive: false } : prev));
      }
      await loadStreams();
      Alert.alert('Success', 'Stream ended.');
    } catch (err) {
      Alert.alert('End stream failed', extractErrorMessage(err, 'Could not end stream'));
    }
  };

  React.useEffect(() => {
    loadStreams();
  }, [user?.id]);

  React.useEffect(() => {
    let intervalId = null;

    const startAutoRefresh = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        loadStreams();
      }, 50000);
    };

    const stopAutoRefresh = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadStreams();
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });

    return () => {
      stopAutoRefresh();
      subscription.remove();
    };
  }, [user?.id]);

  const renderStreamItem = ({ item, own }) => (
    <View style={styles.streamCard}>
      <Text style={[styles.streamTitle, isDark && styles.textPrimaryDark]}>{item.title || 'Untitled stream'}</Text>
      <Text style={[styles.streamMeta, isDark && styles.textMutedDark]}>ID: {item.id} | Live: {String(item.isLive)} | Viewers: {item.viewers || 0}</Text>
      <View style={styles.streamActions}>
        {item.isLive ? (
          <TouchableOpacity style={styles.viewBtn} onPress={() => openViewer(item.id)}>
            <Text style={styles.viewBtnText}>View Live</Text>
          </TouchableOpacity>
        ) : null}
        {own && item.isLive ? (
          <TouchableOpacity style={styles.endBtn} onPress={() => onEndStream(item.id)}>
            <Text style={styles.endBtnText}>End Stream</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, isDark && styles.screenDark]}
      contentContainerStyle={[styles.content, isDark && styles.screenDark]}
      refreshControl={<RefreshControl refreshing={loadingLists} onRefresh={loadStreams} colors={['#0f766e']} />}
    >
      <Text style={[styles.title, isDark && styles.textPrimaryDark]}>Go Live</Text>
      <Text style={[styles.subtitle, isDark && styles.textMutedDark]}>Create a stream and switch it live via backend streams API.</Text>

      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        value={title}
        onChangeText={setTitle}
        placeholder="Stream title"
        placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
      />
      <TextInput
        style={[styles.input, styles.multiline, isDark && styles.inputDark]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
        multiline
      />

      <TouchableOpacity
        style={styles.cameraButton}
        onPress={async () => {
          try {
            await openCameraCheck();
          } catch (err) {
            Alert.alert('Camera check failed', extractErrorMessage(err, 'Could not open camera'));
          }
        }}
      >
        <Text style={styles.cameraButtonText}>{cameraChecked ? 'Camera ready' : 'Open camera first'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onGoLive} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start Live</Text>}
      </TouchableOpacity>

      {lastStream ? (
        <View style={[styles.result, isDark && styles.cardDark]}>
          <Text style={[styles.resultTitle, isDark && styles.textPrimaryDark]}>Last stream</Text>
          <Text style={isDark && styles.textMutedDark}>ID: {lastStream.id}</Text>
          <Text style={isDark && styles.textMutedDark}>Title: {lastStream.title}</Text>
          <Text style={isDark && styles.textMutedDark}>Live: {String(lastStream.isLive)}</Text>
          <Text style={isDark && styles.textMutedDark}>Stream key: {lastStream.streamKey || 'N/A'}</Text>
        </View>
      ) : null}

      {loadingLists && myStreams.length === 0 && liveStreams.length === 0 ? (
        <View style={styles.skelWrap}>
          {[1, 2].map((i) => (
            <View key={`sk-${i}`} style={styles.streamCard}>
              <View style={[styles.skelLineTitle, isDark && styles.skelDark]} />
              <View style={[styles.skelLineMeta, isDark && styles.skelDark]} />
            </View>
          ))}
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadStreams}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

          <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>My Streams</Text>
          {myStreams.length === 0 ? <Text style={[styles.empty, isDark && styles.textMutedDark]}>No streams created yet.</Text> : myStreams.map((item) => (
            <View key={`my-${item.id}`}>{renderStreamItem({ item, own: true })}</View>
          ))}

          <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>Live Now</Text>
          {liveStreams.length === 0 ? <Text style={[styles.empty, isDark && styles.textMutedDark]}>No active streams right now.</Text> : null}
          {[...liveStreams]
            .sort((a, b) => {
              if (!focusStreamId) return 0;
              if (String(a.id) === String(focusStreamId)) return -1;
              if (String(b.id) === String(focusStreamId)) return 1;
              return 0;
            })
            .map((item) => (
            <View key={`live-${item.id}`}>{renderStreamItem({ item, own: false })}</View>
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenDark: {
    backgroundColor: '#020617',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#475569',
  },
  input: {
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  streamActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  viewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  viewBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#e2e8f0',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 6,
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cameraButton: {
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  result: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  cardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  resultTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  streamCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  textPrimaryDark: {
    color: '#e2e8f0',
  },
  textMutedDark: {
    color: '#94a3b8',
  },
  streamTitle: {
    fontWeight: '700',
    color: '#0f172a',
  },
  streamMeta: {
    marginTop: 4,
    color: '#475569',
  },
  endBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  endBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    color: '#64748b',
    marginBottom: 4,
  },
  errorWrap: {
    marginTop: 14,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 8,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  skelWrap: {
    marginTop: 14,
  },
  skelLineTitle: {
    width: '55%',
    height: 13,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  skelLineMeta: {
    width: '75%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  skelDark: {
    backgroundColor: '#1e293b',
  },
});
