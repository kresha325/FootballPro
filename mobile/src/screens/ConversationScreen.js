import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  conversationMessagesRequest,
  extractErrorMessage,
  markConversationReadRequest,
  sendConversationMessageRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

const upsertMessage = (prev, incoming) => {
  if (!incoming?.id) return prev;
  const idx = prev.findIndex((m) => m.id === incoming.id);
  if (idx === -1) return [...prev, incoming];
  const next = [...prev];
  next[idx] = incoming;
  return next;
};

function MessageBubble({ message, mine }) {
  const sender = message?.sender;
  const name = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User';
  const timestamp = message?.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const isRead = message?.isRead;

  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
      {!mine ? <Text style={styles.sender}>{name}</Text> : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {message?.attachmentUrl && (
          <View style={styles.attachmentPreview}>
            <MaterialCommunityIcons name="attachment" size={16} color={mine ? 'white' : '#0f766e'} />
            <Text style={[styles.attachmentName, mine && styles.attachmentNameMine]} numberOfLines={1}>
              {message.attachmentName || 'Attachment'}
            </Text>
          </View>
        )}
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
          {message?.content || ''}
        </Text>
        <View style={styles.messageMeta}>
          <Text style={[styles.timestamp, mine && styles.timestampMine]}>
            {timestamp}
          </Text>
          {mine && (
            <MaterialCommunityIcons
              name={isRead ? 'check-all' : 'check'}
              size={14}
              color={isRead ? '#10b981' : mine ? '#ccc' : '#999'}
              style={styles.readIcon}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default function ConversationScreen({ route }) {
  const { conversationId } = route.params;
  const { user, getSocket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState('');

  const sortedMessages = useMemo(() => {
    const list = Array.isArray(messages) ? [...messages] : [];
    return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await conversationMessagesRequest(conversationId, { limit: 50, page: 1 });
      const list = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      setMessages(list);
      await markConversationReadRequest(conversationId);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load messages'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket || !conversationId) {
      return undefined;
    }

    const roomId = String(conversationId);
    socket.emit('joinConversation', roomId);

    const onNewMessage = (message) => {
      if (String(message?.conversationId) !== roomId) {
        return;
      }

      setMessages((prev) => upsertMessage(prev, message));

      if (message?.senderId !== user?.id) {
        markConversationReadRequest(conversationId).catch(() => {
          // Ignore read-marking errors to keep chat flow smooth.
        });
      }
    };

    const onTyping = (data) => {
      if (data?.senderId !== user?.id) {
        setTypingIndicator(`${data?.senderName || 'User'} is typing...`);
      }
    };

    const onStopTyping = () => {
      setTypingIndicator('');
    };

    socket.on('newMessage', onNewMessage);
    socket.on('userTyping', onTyping);
    socket.on('stopTyping', onStopTyping);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('userTyping', onTyping);
      socket.off('stopTyping', onStopTyping);
      socket.emit('leaveConversation', roomId);
    };
  }, [conversationId, getSocket, user?.id]);

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError('');
    try {
      const response = await sendConversationMessageRequest(conversationId, content);
      setDraft('');
      if (response?.data) {
        setMessages((prev) => upsertMessage(prev, response.data));
      } else {
        await loadMessages();
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleAttach = (type) => {
    console.log('Attaching file type:', type);
    // This would trigger file picker in a real app
    // For now, just show it's selected
    setShowAttachmentMenu(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={sortedMessages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble message={item} mine={item?.senderId === user?.id} />}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
        ListFooterComponent={
          typingIndicator ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>{typingIndicator}</Text>
              <View style={styles.typingDots}>
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
              </View>
            </View>
          ) : null
        }
      />
      <View style={styles.inputWrap}>
        {showAttachmentMenu && (
          <View style={styles.attachmentMenu}>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => handleAttach('photo')}
            >
              <MaterialCommunityIcons name="image" size={20} color="#2563eb" />
              <Text style={styles.attachmentLabel}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => handleAttach('video')}
            >
              <MaterialCommunityIcons name="video" size={20} color="#2563eb" />
              <Text style={styles.attachmentLabel}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={() => handleAttach('file')}
            >
              <MaterialCommunityIcons name="file-document" size={20} color="#2563eb" />
              <Text style={styles.attachmentLabel}>File</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
        >
          <MaterialCommunityIcons name="paperclip" size={20} color="#0f766e" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          multiline
          placeholderTextColor="#cbd5e1"
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending}
        >
          <MaterialCommunityIcons
            name={sending ? 'loading' : 'send'}
            size={18}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12 },
  bubbleWrap: { marginBottom: 10, maxWidth: '86%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapOther: { alignSelf: 'flex-start' },
  sender: { color: '#64748b', fontSize: 12, marginBottom: 2 },
  bubble: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#0f766e' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { color: '#111827', fontSize: 14 },
  bubbleTextMine: { color: '#fff' },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: { fontSize: 11, color: '#999', marginRight: 4 },
  timestampMine: { color: 'rgba(255,255,255,0.7)' },
  readIcon: { marginLeft: 2 },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  attachmentName: { marginLeft: 6, fontSize: 12, color: '#0f766e', flex: 1 },
  attachmentNameMine: { color: 'white' },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 2,
  },
  error: { color: '#dc2626', padding: 8, textAlign: 'center', fontSize: 12 },
  empty: { textAlign: 'center', color: '#cbd5e1', marginTop: 40 },
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    marginRight: 8,
    marginBottom: 2,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  attachmentMenu: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  attachmentOption: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachmentLabel: {
    fontSize: 11,
    color: '#1f2937',
    marginTop: 4,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0f766e',
    height: 42,
    width: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});

export default function ConversationScreen({ route }) {
  const { conversationId } = route.params;
  const { user, getSocket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const sortedMessages = useMemo(() => {
    const list = Array.isArray(messages) ? [...messages] : [];
    return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await conversationMessagesRequest(conversationId, { limit: 50, page: 1 });
      const list = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      setMessages(list);
      await markConversationReadRequest(conversationId);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load messages'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket || !conversationId) {
      return undefined;
    }

    const roomId = String(conversationId);
    socket.emit('joinConversation', roomId);

    const onNewMessage = (message) => {
      if (String(message?.conversationId) !== roomId) {
        return;
      }

      setMessages((prev) => upsertMessage(prev, message));

      if (message?.senderId !== user?.id) {
        markConversationReadRequest(conversationId).catch(() => {
          // Ignore read-marking errors to keep chat flow smooth.
        });
      }
    };

    socket.on('newMessage', onNewMessage);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.emit('leaveConversation', roomId);
    };
  }, [conversationId, getSocket, user?.id]);

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError('');
    try {
      const response = await sendConversationMessageRequest(conversationId, content);
      setDraft('');
      if (response?.data) {
        setMessages((prev) => upsertMessage(prev, response.data));
      } else {
        await loadMessages();
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send message'));
    } finally {
      setSending(false);
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={sortedMessages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble message={item} mine={item?.senderId === user?.id} />}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
      />
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={onSend} disabled={sending}>
          <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12 },
  bubbleWrap: { marginBottom: 10, maxWidth: '86%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapOther: { alignSelf: 'flex-start' },
  sender: { color: '#64748b', fontSize: 12, marginBottom: 2 },
  bubble: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#0f766e' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { color: '#111827' },
  bubbleTextMine: { color: '#fff' },
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
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0f766e',
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 28 },
  error: { color: '#b91c1c', textAlign: 'center', marginTop: 8 },
});
