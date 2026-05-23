import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

export default function NotificationHeaderButton() {
  const navigation = useNavigation();
  const { getSocket } = useAuth();
  const { notificationsCount: count, refresh } = useUnreadBadges(getSocket);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openNotifications = () => {
    const state = navigation.getState?.();
    const names = state?.routeNames;
    if (Array.isArray(names) && names.includes('Notifications')) {
      navigation.navigate('Notifications');
      return;
    }
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('More', { screen: 'Notifications' });
      return;
    }
    navigation.navigate('More', { screen: 'Notifications' });
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
