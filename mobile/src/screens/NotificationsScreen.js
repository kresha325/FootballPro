import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  deleteNotificationRequest,
  extractErrorMessage,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  notificationsRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadges } from '../hooks/useUnreadBadges';
import { getNotificationIcon, navigateFromNotification } from '../utils/navigateFromNotification';

function NotificationRow({ item, onPress, onDelete, deleting }) {
  const icon = getNotificationIcon(item);
  return (
    <TouchableOpacity
      style={[styles.row, !item.isRead && styles.rowUnread]}
      onPress={() => onPress(item)}
      onLongPress={() => onDelete(item.id)}
      delayLongPress={400}
      disabled={deleting}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.rowMain}>
        <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title || 'Notification'}</Text>
        <Text style={styles.message}>{item.message || ''}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteIconBtn}
        onPress={() => onDelete(item.id)}
        disabled={deleting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Delete notification"
      >
        <Ionicons name="trash-outline" size={18} color="#b91c1c" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { getSocket, socketConnected } = useAuth();
  const { notificationsCount, refresh: refreshBadges } = useUnreadBadges(getSocket, socketConnected);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await notificationsRequest({ page: 1, limit: 30 });
      const list = Array.isArray(response?.data?.notifications) ? response.data.notifications : [];
      setItems(list);
      await refreshBadges();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load notifications'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshBadges]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onPressNotification = async (item) => {
    if (!item?.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      try {
        await markNotificationReadRequest(item.id);
        await refreshBadges();
      } catch (_err) {
        /* optimistic UI */
      }
    }

    const navigated = await navigateFromNotification(item, navigation);
    if (!navigated) {
      Alert.alert('Notification', item.message || item.title || 'No destination for this notification.');
    }
  };

  const onDelete = (id) => {
    if (deletingId) return;
    Alert.alert('Delete notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          const prev = items;
          setItems((curr) => curr.filter((n) => n.id !== id));
          try {
            await deleteNotificationRequest(id);
            await refreshBadges();
          } catch (err) {
            setItems(prev);
            setError(extractErrorMessage(err, 'Failed to delete notification'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const onMarkAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    const prev = items;
    setItems((curr) => curr.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsReadRequest();
      await refreshBadges();
    } catch (err) {
      setItems(prev);
      setError(extractErrorMessage(err, 'Failed to mark all as read'));
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {notificationsCount > 0 ? (
            <Text style={styles.unreadHint}>{notificationsCount} unread</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={onMarkAll} disabled={markingAll}>
          <Text style={styles.headerAction}>{markingAll ? '...' : 'Mark all'}</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications({ silent: true });
            }}
            colors={['#0f766e']}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={onPressNotification}
            onDelete={onDelete}
            deleting={deletingId === item.id}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  unreadHint: { color: '#dc2626', fontWeight: '700', fontSize: 13, marginTop: 2 },
  headerAction: { color: '#0f766e', fontWeight: '700' },
  list: { padding: 12 },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowUnread: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  icon: { fontSize: 26, marginRight: 10, marginTop: 2 },
  rowMain: { flex: 1, paddingRight: 8 },
  deleteIconBtn: { padding: 4 },
  title: { fontWeight: '600', color: '#111827' },
  titleUnread: { fontWeight: '800' },
  message: { color: '#475569', marginTop: 4 },
  meta: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  error: { color: '#b91c1c', textAlign: 'center', paddingHorizontal: 12 },
});
