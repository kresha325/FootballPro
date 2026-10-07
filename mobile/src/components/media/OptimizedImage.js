import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from '../../theme/nativeComponents';
import { getOptimizedImageUrl } from '../../utils/imageUrl';

/**
 * Cached list/feed image. Missing URIs and load errors render an empty box
 * instead of throwing. Full-screen previews should omit width/height so the
 * original URL is kept.
 */
export default function OptimizedImage({
  uri,
  source,
  style,
  contentFit = 'cover',
  cachePolicy = 'memory-disk',
  width,
  height,
  quality,
  format,
  recyclingKey,
  placeholderColor = '#e2e8f0',
  onError,
  accessibilityLabel,
}) {
  const raw = uri || source?.uri || (typeof source === 'string' ? source : '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [raw]);

  if (!raw || failed) {
    return <View style={[styles.fallback, { backgroundColor: placeholderColor }, style]} />;
  }

  const optimized = getOptimizedImageUrl(raw, { width, height, quality, format });

  return (
    <Image
      source={{ uri: optimized }}
      style={style}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey || optimized}
      accessibilityLabel={accessibilityLabel}
      onError={(event) => {
        setFailed(true);
        if (onError) onError(event);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { overflow: 'hidden' },
});
