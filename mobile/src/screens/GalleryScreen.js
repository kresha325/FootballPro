import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { deleteGalleryItemRequest, extractErrorMessage, myGalleryRequest } from '../api/client';

function GalleryCard({ item, onDelete }) {
  const isVideo = !!item?.videoUrl;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item?.title || 'Untitled'}</Text>
      {item?.description ? <Text style={styles.description}>{item.description}</Text> : null}

      {isVideo ? (
        <View style={styles.videoWrap}>
          <Video source={{ uri: item.videoUrl }} style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping={false} />
        </View>
      ) : (
        <Image source={{ uri: item?.imageUrl }} style={styles.image} resizeMode="cover" />
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GalleryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadGallery = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await myGalleryRequest();
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load gallery'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const onDelete = (item) => {
    Alert.alert('Delete item', 'Are you sure you want to remove this from gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGalleryItemRequest(item.id);
            setItems((prev) => prev.filter((g) => g.id !== item.id));
          } catch (err) {
            Alert.alert('Delete failed', extractErrorMessage(err, 'Could not delete item'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => <GalleryCard item={item} onDelete={onDelete} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadGallery({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListEmptyComponent={<Text style={styles.empty}>Your gallery is empty.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
    backgroundColor: '#f8fafc',
    minHeight: '100%',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  title: {
    fontWeight: '700',
    color: '#0f172a',
  },
  description: {
    marginTop: 4,
    marginBottom: 8,
    color: '#475569',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  videoWrap: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: 240,
  },
  deleteButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  empty: {
    marginTop: 30,
    textAlign: 'center',
    color: '#64748b',
  },
});
