import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../components/UserAvatar';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import CreateGroupModal from '../components/messaging/CreateGroupModal';
import { conversationsRequest, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BACKEND_URL } from '../config/constants';
import { openUserProfile } from '../utils/openUserProfile';
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

function ConversationRow({ item, onPress, currentUserId, onOpenProfile, colors }) {
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

  const timeLabel = formatConvTime(item.lastMessageAt);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.rowInner}>
        <UserAvatar
          uri={photoUri}
          user={other}
          size={48}
          style={styles.avatarSpacing}
          onPress={!item.isGroup && other?.id ? () => onOpenProfile?.(other.id) : undefined}
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.rowTopRight}>
              {timeLabel ? <Text style={[styles.time, { color: colors.mutedSoft }]}>{timeLabel}</Text> : null}
              {!!item.unreadCount && <Text style={styles.badge}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>}
            </View>
          </View>
          <Text style={[styles.preview, { color: colors.muted }]} numberOfLines={1}>
            {item.lastMessage || 'Ende pa mesazhe.'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagingScreen({ navigation }) {
  const { user, getSocket, socketConnected } = useAuth();
  const { colors, isDark } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const hasFocusedOnce = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowCreateGroup(true)}
            accessibilityLabel="Krijo grup"
          >
            <Ionicons name="people-outline" size={22} color="#0f766e" />
          </TouchableOpacity>
          <NotificationHeaderButton />
        </View>
      ),
    });
  }, [navigation]);

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
      <View style={[styles.centered, { backgroundColor: colors.bgElevated }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
    <FlatList
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: colors.bgElevated }}
      contentContainerStyle={[styles.list, { backgroundColor: colors.bgElevated }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadConversations({ silent: true });
          }}
          colors={[isDark ? '#2dd4bf' : '#0f766e']}
          tintColor={isDark ? '#2dd4bf' : '#0f766e'}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kërko bisedë…"
            placeholderTextColor={colors.mutedSoft}
            style={[
              styles.search,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            clearButtonMode="while-editing"
          />
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.muted }]}>
          {conversations.length === 0 ? 'Ende nuk ke biseda.' : 'Nuk u gjet asgjë për këtë kërkim.'}
        </Text>
      }
      renderItem={({ item }) => (
        <ConversationRow
          item={item}
          colors={colors}
          currentUserId={user?.id}
          onOpenProfile={(uid) => openUserProfile(navigation, uid)}
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
    <CreateGroupModal
      visible={showCreateGroup}
      onClose={() => setShowCreateGroup(false)}
      conversations={conversations}
      currentUserId={user?.id}
      onCreated={(created) => {
        setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        navigation.navigate('Conversation', {
          conversationId: created.id,
          title: created.name || 'Grup',
          isGroup: true,
          otherUserId: null,
        });
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  headerIconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerBlock: { marginBottom: 10 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  list: { padding: 14, minHeight: '100%' },
  row: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  avatarSpacing: { marginRight: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTopRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  title: { fontWeight: '700', flex: 1, minWidth: 0 },
  time: { fontSize: 12, flexShrink: 0, marginRight: 8 },
  preview: { marginTop: 6, fontSize: 14 },
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
  empty: { textAlign: 'center', marginTop: 26 },
  error: { color: '#b91c1c', marginBottom: 10, textAlign: 'center' },
});
