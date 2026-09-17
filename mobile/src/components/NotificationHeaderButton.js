import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

export default function NotificationHeaderButton() {
  const navigation = useNavigation();
  const { getSocket, socketConnected } = useAuth();
  const { notificationsCount: count, refresh } = useUnreadBadges(getSocket, socketConnected);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openNotifications = () => {
    const state = navigation.getState?.();
    const names = state?.routeNames;
    // Already inside More stack — push with MoreHome underneath for a reliable back target.
    if (Array.isArray(names) && names.includes('Notifications') && names.includes('MoreHome')) {
      navigation.navigate({
        name: 'Notifications',
        // Keep stack: MoreHome → Notifications (so back / More tab return to burger menu)
      });
      return;
    }
    const parent = navigation.getParent?.();
    const openInMore = (nav) => {
      // Explicit stack so opening from Feed/Messages never leaves Notifications without back.
      nav.navigate('More', {
        state: {
          routes: [{ name: 'MoreHome' }, { name: 'Notifications' }],
          index: 1,
        },
      });
    };
    if (parent?.navigate) {
      openInMore(parent);
      return;
    }
    openInMore(navigation);
  };

  return (
    <TouchableOpacity
      onPress={openNotifications}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
    >
      <Ionicons name="notifications-outline" size={24} color="#0f766e" />
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
