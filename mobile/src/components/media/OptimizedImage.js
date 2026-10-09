import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { getOptimizedImageUrl } from '../../utils/imageUrl';

/**
 * List and feed image. URLs are sized before they are requested. The phone
 * decodes and caches the bitmap, so scrolling does not do that work in JS.
 */
export default function OptimizedImage({
  uri,
  source,
  style,
  contentFit = 'cover',
  width,
  height,
  quality,
  format,
  placeholderColor = '#e2e8f0',
  onError,
  accessibilityLabel,
}) {
  const bundled = typeof source === 'number' ? source : null;
  const raw = bundled ? '' : uri || source?.uri || (typeof source === 'string' ? source : '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [raw]);

  const fit = contentFit === 'contain' || contentFit === 'fill' ? contentFit : 'cover';

  if (bundled) {
    return (
      <Image
        source={bundled}
        style={style}
        contentFit={fit}
        cachePolicy="memory-disk"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  if (!raw || failed) {
    return <View style={[styles.fallback, { backgroundColor: placeholderColor }, style]} />;
  }

  const optimized = getOptimizedImageUrl(raw, { width, height, quality, format });

  return (
    <Image
      source={{ uri: optimized }}
      style={style}
      contentFit={fit}
      cachePolicy="memory-disk"
      recyclingKey={optimized}
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
