import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { conversationsRequest, extractErrorMessage } from '../api/client';

function ConversationRow({ item, onPress }) {
  const members = Array.isArray(item.members) ? item.members : [];
  const names = members
    .map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>{names || 'Conversation'}</Text>
        {!!item.unreadCount && <Text style={styles.badge}>{item.unreadCount}</Text>}
      </View>
      <Text style={styles.preview} numberOfLines={1}>{item.lastMessage || 'No messages yet.'}</Text>
    </TouchableOpacity>
  );
}

export default function MessagingScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const response = await conversationsRequest();
      setConversations(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load conversations'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadConversations({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      renderItem={({ item }) => (
        <ConversationRow
          item={item}
          onPress={() => navigation.navigate('Conversation', { conversationId: item.id, title: 'Messages' })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 14, backgroundColor: '#f8fafc', minHeight: '100%' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  preview: { color: '#6b7280', marginTop: 6 },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#fff',
    backgroundColor: '#dc2626',
    fontWeight: '700',
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 26 },
  error: { color: '#b91c1c', marginBottom: 10, textAlign: 'center' },
});
