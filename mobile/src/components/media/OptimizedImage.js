import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from '../../theme/nativeComponents';
import { getOptimizedImageUrl } from '../../utils/imageUrl';

/**
 * List and feed image. URLs are sized before they are requested. Missing URIs
 * and load errors render an empty box. Full-screen previews should omit
 * width and height so the original URL is kept.
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
  const raw = uri || source?.uri || (typeof source === 'string' ? source : '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [raw]);

  if (!raw || failed) {
    return <View style={[styles.fallback, { backgroundColor: placeholderColor }, style]} />;
  }

  const optimized = getOptimizedImageUrl(raw, { width, height, quality, format });

  const resizeMode = contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover';

  return (
    <Image
      source={{ uri: optimized }}
      style={style}
      resizeMode={resizeMode}
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
