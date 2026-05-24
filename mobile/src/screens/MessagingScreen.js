import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { conversationsRequest, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config/constants';
import {
  lastMessagePreview,
  messageBelongsToConversation,
  normalizeMessagePayload,
} from '../utils/messagingRealtime';

function mediaBaseUrl() {
  return String(BACKEND_URL || '').replace(/\/$/, '');
}

function resolvePhotoUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${mediaBaseUrl()}${path}`;
}

function memberPhoto(m) {
  if (!m) return null;
  return m.profilePhoto || m.Profile?.profilePhoto || null;
}

function formatConvTime(iso) {
  if (iso == null) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ConversationRow({ item, onPress, currentUserId }) {
  const members = Array.isArray(item.members) ? item.members : [];
  let title = 'Bisedë';
  let other = null;

  if (item.isGroup) {
    title = item.name || 'Grup';
  } else if (currentUserId != null) {
    other = members.find((m) => Number(m.id) !== Number(currentUserId)) || null;
    if (other) {
      title = `${other.firstName || ''} ${other.lastName || ''}`.trim() || title;
    } else {
      title =
        members
          .map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
          .filter(Boolean)
          .join(', ') || title;
    }
  } else {
    other = members[0] || null;
    title =
      members
        .map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
        .filter(Boolean)
        .join(', ') || title;
  }

  const photoRaw = item.isGroup ? item.avatar : memberPhoto(other);
  const photoUri = photoRaw ? resolvePhotoUrl(photoRaw) : null;
  const initials = item.isGroup
    ? (item.name || 'G').charAt(0).toUpperCase()
    : `${(other?.firstName || 'U').charAt(0)}${(other?.lastName || '').charAt(0)}`.toUpperCase() || '?';

  const timeLabel = formatConvTime(item.lastMessageAt);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowInner}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initials}</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.rowTopRight}>
              {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
              {!!item.unreadCount && <Text style={styles.badge}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>}
            </View>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage || 'Ende pa mesazhe.'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagingScreen({ navigation }) {
  const { user, getSocket, socketConnected } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasFocusedOnce = useRef(false);

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

  useFocusEffect(
    useCallback(() => {
      const silent = hasFocusedOnce.current;
      hasFocusedOnce.current = true;
      loadConversations({ silent });
    }, [loadConversations])
  );

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return undefined;

    const onNewMessage = (raw) => {
      const message = normalizeMessagePayload(raw);
      if (!message?.conversationId) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => messageBelongsToConversation(message, c.id));
        if (idx === -1) {
          loadConversations({ silent: true });
          return prev;
        }
        const conv = prev[idx];
        const isFromOther =
          message.senderId != null && Number(message.senderId) !== Number(user?.id);
        const updated = {
          ...conv,
          lastMessage: lastMessagePreview(message),
          lastMessageAt: message.createdAt || new Date().toISOString(),
          unreadCount: isFromOther ? (conv.unreadCount || 0) + 1 : conv.unreadCount || 0,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    };

    socket.on('newMessage', onNewMessage);
    return () => {
      socket.off('newMessage', onNewMessage);
    };
  }, [getSocket, socketConnected, loadConversations, user?.id]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const members = Array.isArray(c.members) ? c.members : [];
      if (c.isGroup) {
        return (c.name || '').toLowerCase().includes(q);
      }
      const other = user?.id != null ? members.find((m) => Number(m.id) !== Number(user.id)) : null;
      const label = other
        ? `${other.firstName || ''} ${other.lastName || ''}`.trim().toLowerCase()
        : members.map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim().toLowerCase()).join(' ');
      return label.includes(q);
    });
  }, [conversations, query, user?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
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
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kërko bisedë…"
            placeholderTextColor="#94a3b8"
            style={styles.search}
            clearButtonMode="while-editing"
          />
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {conversations.length === 0 ? 'Ende nuk ke biseda.' : 'Nuk u gjet asgjë për këtë kërkim.'}
        </Text>
      }
      renderItem={({ item }) => (
        <ConversationRow
          item={item}
          currentUserId={user?.id}
          onPress={() => {
            const members = Array.isArray(item.members) ? item.members : [];
            const other =
              !item.isGroup && user?.id != null
                ? members.find((m) => Number(m.id) !== Number(user.id))
                : null;
            navigation.navigate('Conversation', {
              conversationId: item.id,
              title: item.isGroup
                ? item.name || 'Grup'
                : other
                  ? `${other.firstName || ''} ${other.lastName || ''}`.trim() || undefined
                  : undefined,
              isGroup: !!item.isGroup,
              otherUserId: other?.id ?? null,
            });
          }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBlock: { marginBottom: 10 },
  search: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#0f172a',
  },
  list: { padding: 14, backgroundColor: '#f8fafc', minHeight: '100%' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f766e',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTopRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  title: { fontWeight: '700', color: '#111827', flex: 1, minWidth: 0 },
  time: { fontSize: 12, color: '#94a3b8', flexShrink: 0, marginRight: 8 },
  preview: { color: '#6b7280', marginTop: 6, fontSize: 14 },
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
    fontSize: 12,
    overflow: 'hidden',
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 26 },
  error: { color: '#b91c1c', marginBottom: 10, textAlign: 'center' },
});
