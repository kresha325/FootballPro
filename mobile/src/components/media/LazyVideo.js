import React, { useEffect, useRef } from 'react';
import { Image, Modal, Pressable, StyleSheet, TouchableOpacity, View } from '../../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function releasePlayer(player) {
  if (!player) return;
  player.stopAsync?.().catch(() => {});
  player.unloadAsync?.().catch(() => {});
}

/** One Expo AV player that releases the native resource when it unmounts or the URI changes. */
export function ManagedVideo({ source, ...rest }) {
  const ref = useRef(null);
  const uri = source?.uri || '';

  useEffect(() => {
    const player = ref.current;
    return () => releasePlayer(player);
  }, [uri]);

  return <Video key={uri || 'video'} ref={ref} source={source} {...rest} />;
}

/**
 * List/card poster. Does not mount a Video.
 * Pass onPress to play; omit it when a parent already handles the tap.
 */
export function VideoPoster({
  posterUri,
  style,
  onPress,
  onLongPress,
  accessibilityLabel = 'Luaj videon',
}) {
  const body = (
    <>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}
      <View style={styles.playBadge} pointerEvents="none">
        <Ionicons name="play" size={22} color="#fff" />
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.poster, style]} pointerEvents="none">
        {body}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.poster, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </TouchableOpacity>
  );
}

/** Full-screen player for a single URI. Unmounting it releases the media resource. */
export function VideoPlayerModal({ uri, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const open = !!(visible && uri);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} accessibilityLabel="Mbyll videon" />
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 10, right: Math.max(insets.right, 12) }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Mbyll"
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {open ? (
          <ManagedVideo
            source={{ uri }}
            style={styles.modalVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  poster: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  closeBtn: {
    position: 'absolute',
    zIndex: 2,
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalVideo: { width: '100%', height: '80%' },
});
