import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
}

function isVideoPath(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
}

export default function PublicProfileGalleryTab({ items = [], theme }) {
  const [modalUri, setModalUri] = useState(null);
  const insets = useSafeAreaInsets();

  const closeModal = () => setModalUri(null);

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>📸</Text>
        <Text style={[styles.emptyTitle, { color: theme.muted }]}>No gallery items yet</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.grid}>
        {items.map((item) => {
          const img = item.imageUrl && isImageUrl(item.imageUrl) ? item.imageUrl : null;
          const vid = item.videoUrl || (item.imageUrl && isVideoPath(item.imageUrl) ? item.imageUrl : null);
          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[styles.tile, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
              activeOpacity={0.9}
              onPress={() => {
                if (img) setModalUri({ type: 'image', uri: img });
              }}
            >
              {img ? (
                <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
              ) : vid ? (
                <View style={styles.thumb}>
                  <Video
                    source={{ uri: vid }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    useNativeControls={false}
                  />
                  <View style={styles.playBadge}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={{ fontSize: 28 }}>📁</Text>
                </View>
              )}
              {item.title ? (
                <View style={styles.tileFooter}>
                  <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.tileDate, { color: theme.muted }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={!!modalUri} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} accessibilityLabel="Close preview" />
          <View style={styles.modalLayer} pointerEvents="box-none">
            <Pressable
              onPress={closeModal}
              style={[
                styles.modalClose,
                { top: insets.top + 10, right: Math.max(insets.right, 12) + 4 },
              ]}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <View style={styles.modalCloseInner}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </Pressable>
            {modalUri?.type === 'image' ? (
              <View style={styles.modalImgWrap} pointerEvents="auto">
                <Image source={{ uri: modalUri.uri }} style={styles.modalImg} resizeMode="contain" />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumb: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#0f172a' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tileFooter: { padding: 8 },
  tileTitle: { fontWeight: '700', fontSize: 13 },
  tileDate: { fontSize: 11, marginTop: 2 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalClose: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  modalCloseInner: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalImgWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    minHeight: 200,
  },
  modalImg: { width: '100%', height: '80%', maxHeight: '100%' },
});
