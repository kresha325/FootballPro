import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/AuthContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

export default function NotificationHeaderButton() {
  const navigation = useNavigation();
  const { getSocket, socketConnected } = useSocket();
  const { notificationsCount: count } = useUnreadBadges(getSocket, socketConnected);

  const openNotifications = () => {
    const started = Date.now();
    const state = navigation.getState?.();
    const names = state?.routeNames;
    if (Array.isArray(names) && names.includes('Notifications')) {
      navigation.navigate('Notifications');
    } else {
      const parent = navigation.getParent?.();
      const nav = parent?.navigate ? parent : navigation;
      nav.navigate('More', { screen: 'Notifications' });
    }
    if (__DEV__) console.log(`[NAV PERF] Notifications: ${Date.now() - started}ms`);
  };

  return (
    <TouchableOpacity
      onPress={openNotifications}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
    >
      <Ionicons name="notifications-outline" size={24} color="#9A6B12" />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
