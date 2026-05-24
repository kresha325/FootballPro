import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export function resolveUserPhotoUri(userOrProfile) {
  if (!userOrProfile) return null;
  return (
    userOrProfile.profilePhoto ||
    userOrProfile.photo ||
    userOrProfile.avatar ||
    userOrProfile.Profile?.profilePhoto ||
    userOrProfile.User?.Profile?.profilePhoto ||
    null
  );
}

export function resolveUserInitials(userOrProfile, fallback = '?') {
  if (!userOrProfile) return fallback;
  const firstName = userOrProfile.firstName || userOrProfile.User?.firstName || '';
  const lastName = userOrProfile.lastName || userOrProfile.User?.lastName || '';
  const fromName = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  if (fromName.trim()) return fromName;
  const label = String(userOrProfile.name || userOrProfile.callerName || '').trim();
  if (label) return label.charAt(0).toUpperCase();
  return fallback;
}

export default function UserAvatar({
  uri,
  name,
  user,
  size = 40,
  onPress,
  style,
  textStyle,
  accessibilityLabel = 'Hap profilin',
}) {
  const photoUri = uri || resolveUserPhotoUri(user);
  const initials = resolveUserInitials(user || (name ? { firstName: name } : null));

  const avatarStyle = [
    styles.avatar,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ];
  const fallbackStyle = [
    styles.fallback,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ];
  const fontSize = Math.max(12, Math.round(size * 0.38));

  const content = photoUri ? (
    <Image source={{ uri: photoUri }} style={avatarStyle} />
  ) : (
    <View style={fallbackStyle}>
      <Text style={[styles.initials, { fontSize }, textStyle]}>{initials}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: '#e2e8f0' },
  fallback: {
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#fff', fontWeight: '800' },
});
