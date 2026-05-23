import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  deleteNotificationRequest,
  extractErrorMessage,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  notificationsRequest,
} from '../api/client';

function NotificationRow({ item, onMarkRead, onDelete, deleting }) {
  return (
    <TouchableOpacity
      style={[styles.row, item.isRead && styles.rowRead]}
      onPress={onMarkRead}
      onLongPress={onDelete}
      delayLongPress={400}
      disabled={deleting}
    >
      <View style={styles.rowMain}>
        <Text style={styles.title}>{item.title || 'Notification'}</Text>
        <Text style={styles.message}>{item.message || ''}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteIconBtn}
        onPress={onDelete}
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
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load notifications'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onMarkRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationReadRequest(id);
    } catch (_err) {
      // Keep optimistic UI even if endpoint fails silently.
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
        <Text style={styles.headerTitle}>Notifications</Text>
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
            onMarkRead={() => onMarkRead(item.id)}
            onDelete={() => onDelete(item.id)}
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
  rowRead: { opacity: 0.75 },
  rowMain: { flex: 1, paddingRight: 8 },
  deleteIconBtn: { padding: 4 },
  title: { fontWeight: '700', color: '#111827' },
  message: { color: '#475569', marginTop: 4 },
  meta: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  error: { color: '#b91c1c', textAlign: 'center', paddingHorizontal: 12 },
});
