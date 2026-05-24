import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  conversationsRequest,
  extractErrorMessage,
  sendConversationMessageRequest,
} from '../../api/client';
import { BACKEND_URL } from '../../config/constants';
import { buildForwardSendOptions } from '../../utils/messageActions';
import ReplyPreview from './ReplyPreview';

function mediaBaseUrl() {
  return String(BACKEND_URL || '').replace(/\/$/, '');
}

function convTitle(conv, currentUserId) {
  if (conv.isGroup) return conv.name || 'Grup';
  const members = Array.isArray(conv.members) ? conv.members : [];
  const other =
    currentUserId != null
      ? members.find((m) => Number(m.id) !== Number(currentUserId))
      : members[0];
  if (other) return `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Bisedë';
  return 'Bisedë';
}

function convPhoto(conv, currentUserId) {
  if (conv.isGroup && conv.avatar) return conv.avatar;
  const members = Array.isArray(conv.members) ? conv.members : [];
  const other =
    currentUserId != null
      ? members.find((m) => Number(m.id) !== Number(currentUserId))
      : members[0];
  return other?.profilePhoto || other?.Profile?.profilePhoto || null;
}

function resolvePhotoUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${mediaBaseUrl()}${path}`;
}

export default function ForwardMessageModal({ visible, message, currentUserId, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forwardingId, setForwardingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await conversationsRequest();
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u ngarkuan bisedat'));
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSuccess(false);
      setForwardingId(null);
      setError('');
      load();
    }
  }, [visible, load]);

  const handleForward = async (convId) => {
    if (!message || forwardingId) return;
    setForwardingId(convId);
    setError('');
    try {
      const opts = await buildForwardSendOptions(message, mediaBaseUrl());
      await sendConversationMessageRequest(convId, opts);
      setSuccess(true);
      setTimeout(() => {
        onClose?.();
        setSuccess(false);
      }, 900);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u përcoll mesazhi'));
    } finally {
      setForwardingId(null);
    }
  };

  if (!visible || !message) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Përcjell mesazhin</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Mesazhi që po përcjell:</Text>
            <ReplyPreview message={message} compact />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? (
            <Text style={styles.success}>U përcoll!</Text>
          ) : loading ? (
            <ActivityIndicator style={styles.loader} color="#0f766e" />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>Nuk ke biseda për përcjellje.</Text>}
              renderItem={({ item }) => {
                const title = convTitle(item, currentUserId);
                const photo = resolvePhotoUrl(convPhoto(item, currentUserId));
                const busy = forwardingId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.row, busy && styles.rowBusy]}
                    onPress={() => handleForward(item.id)}
                    disabled={!!forwardingId}
                  >
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarLetter}>{title.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    {busy ? <ActivityIndicator size="small" color="#0f766e" /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '72%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  close: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  previewBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewLabel: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  list: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  rowBusy: { opacity: 0.6 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 16 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  loader: { marginVertical: 24 },
  empty: { textAlign: 'center', color: '#64748b', marginVertical: 20 },
  error: { color: '#b91c1c', textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  success: { color: '#0f766e', textAlign: 'center', marginVertical: 20, fontWeight: '700' },
});
