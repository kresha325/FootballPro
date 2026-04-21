import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  conversationMessagesRequest,
  deleteMessageRequest,
  editMessageRequest,
  extractErrorMessage,
  markConversationReadRequest,
  sendConversationMessageRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config/constants';

/** Kur ngarkohen mesazhe më të vjetra në krye, mos e lëviz pamjen e leximit. */
const MAINTAIN_VISIBLE = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: 64,
};

const upsertMessage = (prev, incoming) => {
  if (!incoming?.id) return prev;
  const idx = prev.findIndex((m) => m.id === incoming.id);
  if (idx === -1) return [...prev, incoming];
  const next = [...prev];
  next[idx] = { ...next[idx], ...incoming };
  return next;
};

function isMineMessage(message, userId) {
  const sid = message?.sender?.id ?? message?.senderId;
  return sid != null && userId != null && Number(sid) === Number(userId);
}

function mediaBaseUrl() {
  return String(BACKEND_URL || '').replace(/\/$/, '');
}

function senderAvatarUrl(message) {
  const raw =
    message?.sender?.profilePhoto ||
    message?.sender?.Profile?.profilePhoto ||
    null;
  if (!raw || typeof raw !== 'string') return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${mediaBaseUrl()}${path}`;
}

function formatMessageTime(iso) {
  if (iso == null) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, mine, onLongPressMine }) {
  const sender = message?.sender;
  const name = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User';
  const deleted = !!message?.deleted;
  const initials =
    `${(sender?.firstName || 'U').charAt(0)}${(sender?.lastName || '').charAt(0)}`.toUpperCase() || '?';
  const avatarUri = !mine ? senderAvatarUrl(message) : null;
  const timeLabel = formatMessageTime(message?.createdAt);

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      {!mine ? (
        avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.msgAvatar} />
        ) : (
          <View style={styles.msgAvatarFallback}>
            <Text style={styles.msgAvatarFallbackText}>{initials}</Text>
          </View>
        )
      ) : null}
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={mine && !deleted ? onLongPressMine : undefined}
        delayLongPress={400}
        style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}
      >
        {!mine ? <Text style={styles.sender}>{name}</Text> : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {deleted ? (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.deletedText]}>Mesazhi u fshi</Text>
          ) : (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message?.content || ''}</Text>
          )}
          {!deleted && message?.edited ? (
            <Text style={[styles.editedHint, mine && styles.editedHintMine]}>(ndryshuar)</Text>
          ) : null}
          {timeLabel ? (
            <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{timeLabel}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function ConversationScreen({ route }) {
  const { conversationId } = route.params;
  const { user, getSocket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [typingByUserId, setTypingByUserId] = useState({});
  const typingTimeoutRef = useRef(null);
  const emitStopTypingRef = useRef(() => {});
  const listRef = useRef(null);
  const didInitialScrollRef = useRef(false);

  /** Rend kronologjik: më të vjetrit lart, më të rinjtë poshtë (pa `inverted` / pa scaleY). */
  const listData = useMemo(() => {
    const list = Array.isArray(messages) ? [...messages] : [];
    return list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      const na = Number.isNaN(ta) ? 0 : ta;
      const nb = Number.isNaN(tb) ? 0 : tb;
      return na - nb;
    });
  }, [messages]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const typingLine = useMemo(() => {
    const entries = Object.entries(typingByUserId).filter(([id]) => Number(id) !== Number(user?.id));
    if (entries.length === 0) return '';
    const names = entries.map(([, name]) => name).filter(Boolean);
    if (names.length === 1) return `${names[0]} po shkruan…`;
    return `${names.join(', ')} po shkruajnë…`;
  }, [typingByUserId, user?.id]);

  const emitTypingBurst = useCallback(() => {
    if (editing) return;
    const socket = getSocket?.();
    if (!socket || !conversationId || !user?.id) return;
    const cid = Number(conversationId) || conversationId;
    const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
    socket.emit('typing', {
      conversationId: cid,
      userId: user.id,
      userName,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { conversationId: cid, userId: user.id });
      typingTimeoutRef.current = null;
    }, 2000);
  }, [conversationId, editing, getSocket, user]);

  const emitStopTyping = useCallback(() => {
    const socket = getSocket?.();
    if (!socket || !conversationId || !user?.id) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socket.emit('stopTyping', {
      conversationId: Number(conversationId) || conversationId,
      userId: user.id,
    });
  }, [conversationId, getSocket, user?.id]);

  emitStopTypingRef.current = emitStopTyping;

  const onDraftChange = useCallback(
    (text) => {
      setDraft(text);
      if (text.trim().length > 0) emitTypingBurst();
      else emitStopTyping();
    },
    [emitTypingBurst, emitStopTyping]
  );

  const loadMessages = useCallback(
    async (opts = {}) => {
      const { skipFullScreenLoading } = opts;
      if (!skipFullScreenLoading) setLoading(true);
      setError('');
      try {
        const response = await conversationMessagesRequest(conversationId, { limit: 50, page: 1 });
        const list = Array.isArray(response?.data?.messages) ? response.data.messages : [];
        setMessages(list);
        setPagination({
          page: response?.data?.page || 1,
          pages: response?.data?.pages || 1,
          total: response?.data?.total || list.length,
        });
        await markConversationReadRequest(conversationId);
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load messages'));
      } finally {
        if (!skipFullScreenLoading) setLoading(false);
      }
    },
    [conversationId]
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlder || pagination.page >= pagination.pages) return;
    const nextPage = pagination.page + 1;
    setLoadingOlder(true);
    setError('');
    try {
      const response = await conversationMessagesRequest(conversationId, { limit: 50, page: nextPage });
      const list = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      setMessages((prev) => [...list, ...prev]);
      setPagination({
        page: response?.data?.page || nextPage,
        pages: response?.data?.pages || pagination.pages,
        total: response?.data?.total ?? pagination.total,
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load older messages'));
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, pagination.page, pagination.pages, pagination.total]);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!loading && listData.length > 0 && !didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scrollToBottom(false);
    }
  }, [loading, listData.length, scrollToBottom]);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await loadMessages({ skipFullScreenLoading: true });
    } finally {
      setPullRefreshing(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket || !conversationId) {
      return undefined;
    }

    const roomId = String(conversationId);

    const rejoinConversationRoom = () => {
      try {
        socket.emit('joinConversation', roomId);
      } catch (_) {
        /* ignore */
      }
    };

    rejoinConversationRoom();
    socket.on('connect', rejoinConversationRoom);
    const ioMgr = socket.io;
    if (ioMgr && typeof ioMgr.on === 'function') {
      ioMgr.on('reconnect', rejoinConversationRoom);
    }

    const onNewMessage = (message) => {
      if (String(message?.conversationId) !== roomId) return;
      setMessages((prev) => upsertMessage(prev, message));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      if (message?.senderId != null && Number(message.senderId) !== Number(user?.id)) {
        markConversationReadRequest(conversationId).catch(() => {});
      }
    };

    const onMessageUpdated = (payload) => {
      if (String(payload?.conversationId) !== roomId) return;
      const msg = payload?.message;
      if (!msg?.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    };

    const onMessageDeleted = (payload) => {
      if (String(payload?.conversationId) !== roomId) return;
      const mid = payload?.messageId;
      if (mid == null) return;
      setMessages((prev) => prev.filter((m) => m.id !== mid));
    };

    const onUserTyping = ({ userId, userName }) => {
      if (userId == null || Number(userId) === Number(user?.id)) return;
      setTypingByUserId((prev) => ({ ...prev, [String(userId)]: userName || '…' }));
    };

    const onUserStoppedTyping = ({ userId }) => {
      if (userId == null) return;
      setTypingByUserId((prev) => {
        const next = { ...prev };
        delete next[String(userId)];
        return next;
      });
    };

    socket.on('newMessage', onNewMessage);
    socket.on('messageUpdated', onMessageUpdated);
    socket.on('messageDeleted', onMessageDeleted);
    socket.on('userTyping', onUserTyping);
    socket.on('userStoppedTyping', onUserStoppedTyping);

    return () => {
      socket.off('connect', rejoinConversationRoom);
      if (ioMgr && typeof ioMgr.off === 'function') {
        ioMgr.off('reconnect', rejoinConversationRoom);
      }
      socket.off('newMessage', onNewMessage);
      socket.off('messageUpdated', onMessageUpdated);
      socket.off('messageDeleted', onMessageDeleted);
      socket.off('userTyping', onUserTyping);
      socket.off('userStoppedTyping', onUserStoppedTyping);
      emitStopTypingRef.current();
      socket.emit('leaveConversation', roomId);
    };
  }, [conversationId, getSocket, user?.id]);

  const onSend = async () => {
    if (editing) {
      const text = (editing.text || '').trim();
      if (!text || sending) return;
      setSending(true);
      setError('');
      try {
        const { data } = await editMessageRequest(editing.id, text);
        setMessages((prev) => prev.map((m) => (m.id === editing.id ? { ...m, ...data, edited: true } : m)));
        setEditing(null);
      } catch (err) {
        setError(extractErrorMessage(err, 'Nuk u ruajt ndryshimi'));
      } finally {
        setSending(false);
      }
      return;
    }

    const content = draft.trim();
    if (!content || sending) return;

    emitStopTyping();
    setSending(true);
    setError('');
    try {
      const response = await sendConversationMessageRequest(conversationId, content);
      setDraft('');
      if (response?.data) {
        setMessages((prev) => upsertMessage(prev, response.data));
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } else {
        await loadMessages({ skipFullScreenLoading: true });
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = (messageId) => {
    Alert.alert('Fshi mesazhin', 'Je i sigurt?', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Fshi',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessageRequest(messageId);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          } catch (err) {
            setError(extractErrorMessage(err, 'Nuk u fshi mesazhi'));
          }
        },
      },
    ]);
  };

  const openMessageActions = useCallback(
    (message) => {
      if (!isMineMessage(message, user?.id)) return;
      Alert.alert('Mesazhi', undefined, [
        {
          text: 'Ndrysho',
          onPress: () => setEditing({ id: message.id, text: message.content || '' }),
        },
        { text: 'Fshi', style: 'destructive', onPress: () => confirmDelete(message.id) },
        { text: 'Anulo', style: 'cancel' },
      ]);
    },
    [user?.id]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const inputValue = editing ? editing.text : draft;
  const setInputValue = editing
    ? (t) => setEditing((e) => (e ? { ...e, text: t } : e))
    : onDraftChange;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {editing ? (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>Po ndryshon mesazhin</Text>
          <TouchableOpacity onPress={() => setEditing(null)}>
            <Text style={styles.editBannerCancel}>Anulo</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        style={styles.listFlex}
        data={listData}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={MAINTAIN_VISIBLE}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onPullRefresh}
            colors={['#0f766e']}
            tintColor="#0f766e"
            progressViewOffset={Platform.OS === 'android' ? 48 : 0}
          />
        }
        ListHeaderComponent={
          pagination.pages > 1 && pagination.page < pagination.pages ? (
            <TouchableOpacity style={styles.loadOlder} onPress={loadOlder} disabled={loadingOlder}>
              <Text style={styles.loadOlderText}>{loadingOlder ? 'Duke ngarkuar…' : 'Mesazhe më të vjetra'}</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={isMineMessage(item, user?.id)}
            onLongPressMine={() => openMessageActions(item)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ende nuk ka mesazhe.</Text>}
      />
      {typingLine ? (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingLine}</Text>
        </View>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={editing ? 'Ndrysho tekstin…' : 'Shkruaj mesazhin…'}
          multiline
          editable={!sending}
          onBlur={emitStopTyping}
        />
        <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={onSend} disabled={sending}>
          <Text style={styles.sendText}>{sending ? '…' : editing ? 'Ruaj' : 'Dërgo'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listFlex: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    maxWidth: '92%',
  },
  bubbleRowMine: { alignSelf: 'flex-end' },
  bubbleRowOther: { alignSelf: 'flex-start' },
  msgAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  msgAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  msgAvatarFallbackText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  bubbleWrap: { maxWidth: '100%', flexShrink: 1 },
  bubbleWrapMine: {},
  bubbleWrapOther: {},
  sender: { color: '#64748b', fontSize: 12, marginBottom: 2 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#0f766e' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { color: '#111827' },
  bubbleTextMine: { color: '#fff' },
  deletedText: { fontStyle: 'italic', opacity: 0.85 },
  editedHint: { fontSize: 10, color: '#64748b', marginTop: 4 },
  editedHintMine: { color: '#e0f2f1' },
  msgTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  msgTimeMine: { color: 'rgba(255,255,255,0.85)' },
  typingBar: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  typingText: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0f766e',
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 28 },
  error: { color: '#b91c1c', textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  loadOlder: { alignSelf: 'center', marginVertical: 10, paddingVertical: 8, paddingHorizontal: 14 },
  loadOlderText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  editBannerText: { color: '#92400e', fontWeight: '600', flex: 1 },
  editBannerCancel: { color: '#0f766e', fontWeight: '700' },
});
