import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { extractErrorMessage, likeVideoRequest, uploadVideoRequest, videosRequest } from '../api/client';

function VideosSkeleton() {
  return (
    <View style={styles.listContent}>
      {[1, 2].map((i) => (
        <View key={`v-${i}`} style={[styles.card, styles.skeletonBlock]} />
      ))}
    </View>
  );
}

function VideoCard({ item, onLike }) {
  const author = item?.User ? `${item.User.firstName || ''} ${item.User.lastName || ''}`.trim() : 'Unknown';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item?.title || 'Untitled video'}</Text>
      {item?.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <Text style={styles.author}>By: {author}</Text>
      {item?.videoUrl ? (
        <View style={styles.videoWrap}>
          <Video source={{ uri: item.videoUrl }} style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping={false} />
        </View>
      ) : null}
      <View style={styles.rowBetween}>
        <Text style={styles.meta}>Views: {item?.views || 0} | Likes: {item?.likes || 0}</Text>
        <TouchableOpacity style={styles.likeBtn} onPress={() => onLike(item.id)}>
          <Text style={styles.likeBtnText}>Like</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function VideosScreen() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadVideos = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    try {
      const res = await videosRequest({ limit: 20 });
      setVideos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Alert.alert('Videos error', extractErrorMessage(err, 'Could not load videos'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow media library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedVideo({
        uri: asset.uri,
        type: asset.mimeType || 'video/mp4',
        name: `video-${Date.now()}.mp4`,
      });
    }
  };

  const upload = async () => {
    if (!selectedVideo) {
      Alert.alert('Video required', 'Choose a video before upload.');
      return;
    }

    setUploading(true);
    try {
      await uploadVideoRequest({
        title: title.trim() || 'Mobile Upload',
        description: description.trim() || '',
        video: selectedVideo,
      });
      setTitle('');
      setDescription('');
      setSelectedVideo(null);
      await loadVideos({ silent: true });
      Alert.alert('Uploaded', 'Video uploaded successfully.');
    } catch (err) {
      Alert.alert('Upload failed', extractErrorMessage(err, 'Could not upload video'));
    } finally {
      setUploading(false);
    }
  };

  const onLike = async (videoId) => {
    try {
      await likeVideoRequest(videoId);
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, likes: Number(v.likes || 0) + 1 } : v)));
    } catch (err) {
      Alert.alert('Like failed', extractErrorMessage(err, 'Could not like video'));
    }
  };

  if (loading) {
    return <VideosSkeleton />;
  }

  return (
    <FlatList
      data={videos}
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadVideos({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListHeaderComponent={
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload Video</Text>
          <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickVideo}>
            <Text style={styles.secondaryBtnText}>{selectedVideo ? 'Change Video' : 'Choose Video'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, uploading && styles.disabled]} onPress={upload} disabled={uploading}>
            <Text style={styles.primaryBtnText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => <VideoCard item={item} onLike={onLike} />}
      ListEmptyComponent={<Text style={styles.empty}>No videos yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  uploadCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  uploadTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#0f766e', fontWeight: '700' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  title: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  description: { color: '#475569', marginTop: 4 },
  author: { color: '#64748b', marginTop: 4, marginBottom: 8 },
  videoWrap: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  video: { width: '100%', height: 220 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: '#475569' },
  likeBtn: { backgroundColor: '#1d4ed8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  likeBtnText: { color: '#fff', fontWeight: '700' },
  skeletonBlock: { height: 220, backgroundColor: '#e2e8f0' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
