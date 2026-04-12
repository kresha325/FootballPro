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
} from 'react-native';
import {
  conversationMessagesRequest,
  extractErrorMessage,
  markConversationReadRequest,
  sendConversationMessageRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

function MessageBubble({ message, mine }) {
  const sender = message?.sender;
  const name = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User';

  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
      {!mine ? <Text style={styles.sender}>{name}</Text> : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message?.content || ''}</Text>
      </View>
    </View>
  );
}

export default function ConversationScreen({ route }) {
  const { conversationId } = route.params;
  const { user } = useAuth();
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

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError('');
    try {
      const response = await sendConversationMessageRequest(conversationId, content);
      setDraft('');
      if (response?.data) {
        setMessages((prev) => [...prev, response.data]);
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
