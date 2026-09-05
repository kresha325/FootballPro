import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { openUserProfile } from '../utils/openUserProfile';
import {
  conversationDetailRequest,
  conversationMessagesRequest,
  deleteMessageRequest,
  editMessageRequest,
  extractErrorMessage,
  markConversationReadRequest,
  sendConversationMessageRequest,
} from '../api/client';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL, WEB_APP_URL } from '../config/constants';
import {
  messageBelongsToConversation,
  normalizeMessagePayload,
} from '../utils/messagingRealtime';
import ForwardMessageModal from '../components/messaging/ForwardMessageModal';
import ReplyPreview from '../components/messaging/ReplyPreview';
import { mergeOthersRead, outboundMessageStatus } from '../utils/messageStatus';

const QUICK_EMOJIS = ['⚽', '🔥', '😀', '😂', '👍', '❤️', '🎉', '👏', '🙌', '😮'];

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

/** Rikthe draft vetëm kur serveri konfirmon që mesazhi nuk u krijua. */
function shouldRestoreDraftAfterSendError(err) {
  const status = err?.response?.status;
  if (status == null) return false;
  if (status >= 500) return false;
  return status >= 400 && status < 500;
}

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

function messageFileUrl(message) {
  const raw = message?.fileUrl;
  if (!raw || typeof raw !== 'string') return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('file:') || raw.startsWith('content:')) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${mediaBaseUrl()}${path}`;
}

function MessageStatusTicks({ status, mine }) {
  if (!mine || !status) return null;
  if (status === 'sending') {
    return <ActivityIndicator size={10} color="rgba(255,255,255,0.85)" style={styles.statusSpinner} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={13} color="#fecaca" style={styles.statusIcon} />;
  }
  if (status === 'seen') {
    return <Ionicons name="checkmark-done" size={15} color="#93c5fd" style={styles.statusIcon} />;
  }
  return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" style={styles.statusIcon} />;
}

function MessageBubble({ message, mine, onLongPress, onOpenImage, outboundStatus, onOpenSenderProfile }) {
  const sender = message?.sender;
  const name = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User';
  const deleted = !!message?.deleted;
  const avatarUri = !mine ? senderAvatarUrl(message) : null;
  const timeLabel = formatMessageTime(message?.createdAt);
  const fileUri = messageFileUrl(message);
  const hasText = !!(message?.content && String(message.content).trim());

  const openFileLink = () => {
    if (fileUri) Linking.openURL(fileUri).catch(() => {});
  };

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      {!mine ? (
        <UserAvatar
          uri={avatarUri}
          user={sender}
          size={32}
          style={styles.msgAvatarSpacing}
          onPress={
            sender?.id && onOpenSenderProfile
              ? () => onOpenSenderProfile(sender.id)
              : undefined
          }
        />
      ) : null}
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={!deleted ? onLongPress : undefined}
        delayLongPress={400}
        style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}
      >
        {!mine ? <Text style={styles.sender}>{name}</Text> : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!deleted && message.replyTo ? (
            <View style={[styles.replyQuote, mine && styles.replyQuoteMine]}>
              <ReplyPreview message={message.replyTo} mine={mine} />
            </View>
          ) : null}
          {deleted ? (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.deletedText]}>Mesazhi u fshi</Text>
          ) : (
            <>
              {!deleted && fileUri && message.type === 'image' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onOpenImage?.(fileUri)}
                  style={styles.mediaWrap}
                >
                  <Image source={{ uri: fileUri }} style={styles.msgImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : null}
              {!deleted && fileUri && message.type === 'video' ? (
                <Video
                  source={{ uri: fileUri }}
                  style={styles.msgVideo}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
              ) : null}
              {!deleted && fileUri && message.type === 'file' ? (
                <TouchableOpacity style={styles.fileRow} onPress={openFileLink}>
                  <Ionicons name="document-outline" size={22} color={mine ? '#e0f2f1' : '#0f766e'} />
                  <Text style={[styles.fileName, mine && styles.fileNameMine]} numberOfLines={2}>
                    {message.fileName || 'Skedar'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!deleted && fileUri && !message.type ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenImage?.(fileUri)} style={styles.mediaWrap}>
                  <Image source={{ uri: fileUri }} style={styles.msgImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : null}
              {hasText ? (
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, fileUri && styles.bubbleTextAfterMedia]}>
                  {message.content}
                </Text>
              ) : null}
            </>
          )}
          {!deleted && message?.edited ? (
            <Text style={[styles.editedHint, mine && styles.editedHintMine]}>(ndryshuar)</Text>
          ) : null}
          <View style={styles.msgMetaRow}>
            {timeLabel ? (
              <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{timeLabel}</Text>
            ) : null}
            <MessageStatusTicks status={outboundStatus} mine={mine} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function ConversationScreen({ route, navigation }) {
  const {
    conversationId,
    otherUserId: paramOtherUserId,
    isGroup: paramIsGroup,
    title: paramTitle,
  } = route.params || {};
  const { user, getSocket, socketConnected } = useAuth();
  const [otherUserId, setOtherUserId] = useState(paramOtherUserId ?? null);
  const [isGroup, setIsGroup] = useState(!!paramIsGroup);
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [previewImageUri, setPreviewImageUri] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [othersRead, setOthersRead] = useState([]);
  const [typingByUserId, setTypingByUserId] = useState({});
  const typingTimeoutRef = useRef(null);
  const composerBlurTimeoutRef = useRef(null);
  const emitStopTypingRef = useRef(() => {});
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (paramOtherUserId != null || paramIsGroup) return undefined;
    let cancelled = false;
    conversationDetailRequest(conversationId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        setIsGroup(!!data?.isGroup);
        if (!data?.isGroup && user?.id != null) {
          const members = Array.isArray(data?.members) ? data.members : [];
          const other = members.find((m) => Number(m.id) !== Number(user.id));
          if (other?.id != null) setOtherUserId(other.id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId, paramOtherUserId, paramIsGroup, user?.id]);

  const openCall = useCallback(
    (audioOnly) => {
      if (isGroup) {
        Alert.alert('Thirrje', 'Thirrjet audio/video janë vetëm për biseda 1-me-1.');
        return;
      }
      if (!otherUserId) {
        Alert.alert('Thirrje', 'Nuk u gjet përdoruesi për thirrje.');
        return;
      }
      if (!WEB_APP_URL) {
        Alert.alert(
          'Thirrje',
          'Konfiguro WEB_APP_URL në app.json (https://xtalenti.com) për thirrje.'
        );
        return;
      }
      navigation.navigate('OutgoingCall', {
        targetUserId: otherUserId,
        audioOnly,
      });
    },
    [isGroup, navigation, otherUserId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      ...(paramTitle ? { title: paramTitle } : {}),
      headerRight: () => (
        <View style={styles.headerActions}>
          {!isGroup && otherUserId ? (
            <>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => openCall(true)}
                accessibilityLabel="Thirrje audio"
              >
                <Ionicons name="call-outline" size={22} color="#0f766e" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => openCall(false)}
                accessibilityLabel="Thirrje video"
              >
                <Ionicons name="videocam-outline" size={24} color="#0f766e" />
              </TouchableOpacity>
            </>
          ) : null}
          <NotificationHeaderButton />
        </View>
      ),
    });
  }, [navigation, isGroup, otherUserId, openCall, paramTitle]);

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

  const appendEmoji = useCallback((emoji) => {
    setDraft((prev) => `${prev}${emoji}`);
  }, []);

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment(null);
  }, []);

  const keepComposerOpen = useCallback(() => {
    if (composerBlurTimeoutRef.current) {
      clearTimeout(composerBlurTimeoutRef.current);
      composerBlurTimeoutRef.current = null;
    }
  }, []);

  const onInputFocus = useCallback(() => {
    keepComposerOpen();
  }, [keepComposerOpen]);

  const onInputBlur = useCallback(() => {
    if (composerBlurTimeoutRef.current) {
      clearTimeout(composerBlurTimeoutRef.current);
    }
    composerBlurTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
      composerBlurTimeoutRef.current = null;
    }, 280);
  }, [emitStopTyping]);

  const pickAttachment = useCallback(async () => {
    if (editing) return;
    keepComposerOpen();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Leje e nevojshme', 'Aktivizo qasjen në galeri për të bashkëngjitur foto ose video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const isVideo =
      asset.type === 'video' || String(asset.mimeType || '').toLowerCase().startsWith('video/');
    const name =
      asset.fileName || (isVideo ? `video-${Date.now()}.mp4` : `image-${Date.now()}.jpg`);
    const mime = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
    setPendingAttachment({ uri: asset.uri, name, type: mime, isVideo });
    setShowEmojiBar(false);
  }, [editing, keepComposerOpen]);

  useEffect(
    () => () => {
      if (composerBlurTimeoutRef.current) clearTimeout(composerBlurTimeoutRef.current);
    },
    []
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
        if (Array.isArray(response?.data?.othersRead)) {
          setOthersRead(response.data.othersRead);
        }
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

    const onNewMessage = (raw) => {
      const message = normalizeMessagePayload(raw, conversationId);
      if (!message || !messageBelongsToConversation(message, conversationId)) return;
      setMessages((prev) => upsertMessage(prev, message));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      const sid = message?.senderId ?? message?.sender?.id;
      if (sid != null && Number(sid) !== Number(user?.id)) {
        markConversationReadRequest(conversationId).catch(() => {});
      }
    };

    const onMessageUpdated = (payload) => {
      if (!messageBelongsToConversation(payload, conversationId)) return;
      const msg = payload?.message;
      if (!msg?.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    };

    const onMessageDeleted = (payload) => {
      if (!messageBelongsToConversation(payload, conversationId)) return;
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

    const onConversationRead = (payload) => {
      if (String(payload?.conversationId) !== String(conversationId)) return;
      const { userId, readAt } = payload || {};
      if (userId == null || Number(userId) === Number(user?.id)) return;
      setOthersRead((prev) => mergeOthersRead(prev, userId, readAt));
    };

    socket.on('newMessage', onNewMessage);
    socket.on('messageUpdated', onMessageUpdated);
    socket.on('messageDeleted', onMessageDeleted);
    socket.on('userTyping', onUserTyping);
    socket.on('userStoppedTyping', onUserStoppedTyping);
    socket.on('conversationRead', onConversationRead);

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
      socket.off('conversationRead', onConversationRead);
      emitStopTypingRef.current();
      socket.emit('leaveConversation', roomId);
    };
  }, [conversationId, getSocket, socketConnected, user?.id]);

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
    const attachment = pendingAttachment;
    if (!content && !attachment) return;

    emitStopTyping();
    const tempId = `pending-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversationId: Number(conversationId) || conversationId,
      content: content || '',
      createdAt: new Date().toISOString(),
      senderId: user?.id,
      sender: user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePhoto: user.profilePhoto || user.Profile?.profilePhoto,
          }
        : null,
      _pending: !!attachment,
      ...(attachment
        ? {
            fileUrl: attachment.uri,
            fileName: attachment.name,
            type: attachment.isVideo ? 'video' : 'image',
          }
        : {}),
    };
    const replySnapshot = replyTo;
    const replyId = replySnapshot?.id;
    setDraft('');
    setPendingAttachment(null);
    setShowEmojiBar(false);
    setReplyTo(null);
    const optimisticWithReply = replySnapshot
      ? { ...optimistic, replyTo: replySnapshot }
      : optimistic;
    setMessages((prev) => upsertMessage(prev, optimisticWithReply));
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    setError('');
    const filePayload = attachment
      ? { uri: attachment.uri, name: attachment.name, type: attachment.type }
      : null;

    (async () => {
      try {
        const response = await sendConversationMessageRequest(conversationId, {
          content,
          file: filePayload,
          replyToId: replyId,
        });
        let saved = normalizeMessagePayload(response?.data, conversationId);
        if (saved?.id && replySnapshot?.fileUrl && saved.replyTo && !saved.replyTo.fileUrl) {
          saved = {
            ...saved,
            replyTo: {
              ...replySnapshot,
              ...saved.replyTo,
              type: saved.replyTo.type || replySnapshot.type,
              fileUrl: replySnapshot.fileUrl,
              fileName: saved.replyTo.fileName || replySnapshot.fileName,
            },
          };
        }
        if (saved?.id) {
          setMessages((prev) => {
            const withoutPending = prev.filter((m) => m.id !== tempId);
            return upsertMessage(withoutPending, saved);
          });
          const socket = getSocket?.();
          if (socket) {
            try {
              socket.emit('sendMessage', { conversationId, message: saved });
            } catch (_) {
              /* ignore */
            }
          }
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          await loadMessages({ skipFullScreenLoading: true });
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _pending: false, _sendFailed: true } : m
          )
        );
        const restore = shouldRestoreDraftAfterSendError(err);
        if (restore) {
          setDraft(content);
          if (attachment) setPendingAttachment(attachment);
          if (replySnapshot) setReplyTo(replySnapshot);
        } else {
          setDraft('');
          setPendingAttachment(null);
          try {
            await loadMessages({ skipFullScreenLoading: true });
          } catch (_syncErr) {
            /* ignore */
          }
        }
        const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''));
        setError(
          isTimeout && !restore
            ? 'Ngarkimi zgjati shumë. Kontrollo nëse mesazhi u dërgua.'
            : extractErrorMessage(err, 'Failed to send message')
        );
      }
    })();
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

  const showMessageActions = useCallback(
    (message) => {
      if (message?.deleted) return;
      const mine = isMineMessage(message, user?.id);
      const canEdit = mine && !message?.fileUrl && !!(message?.content || '').trim();
      const buttons = [
        {
          text: 'Përgjigju',
          onPress: () => {
            setReplyTo(message);
            setShowEmojiBar(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          },
        },
        {
          text: 'Përcjell',
          onPress: () => setForwardMessage(message),
        },
      ];
      if (canEdit) {
        buttons.push({
          text: 'Ndrysho',
          onPress: () => setEditing({ id: message.id, text: message.content || '' }),
        });
      }
      if (mine) {
        buttons.push({
          text: 'Fshi',
          style: 'destructive',
          onPress: () => confirmDelete(message.id),
        });
      }
      buttons.push({ text: 'Anulo', style: 'cancel' });
      Alert.alert('Mesazhi', undefined, buttons);
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
  const canSend = editing ? !!(editing.text || '').trim() : !!(draft.trim() || pendingAttachment);

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
        extraData={listData.length}
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
            outboundStatus={outboundMessageStatus(item, othersRead, user?.id)}
            onLongPress={() => showMessageActions(item)}
            onOpenImage={setPreviewImageUri}
            onOpenSenderProfile={(uid) => openUserProfile(navigation, uid)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ende nuk ka mesazhe.</Text>}
      />
      {typingLine ? (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingLine}</Text>
        </View>
      ) : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {replyTo && !editing ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerBody}>
              <Text style={styles.replyBannerLabel}>Përgjigje te:</Text>
              <ReplyPreview message={replyTo} compact />
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>
        ) : null}
        {pendingAttachment && !editing ? (
          <View style={styles.attachmentPreview}>
            {pendingAttachment.isVideo ? (
              <View style={styles.attachmentThumbPlaceholder}>
                <Ionicons name="videocam" size={28} color="#0f766e" />
              </View>
            ) : (
              <Image source={{ uri: pendingAttachment.uri }} style={styles.attachmentThumb} />
            )}
            <Text style={styles.attachmentName} numberOfLines={1}>
              {pendingAttachment.name}
            </Text>
            <TouchableOpacity onPress={clearPendingAttachment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>
        ) : null}
        {showEmojiBar && !editing ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiBar} contentContainerStyle={styles.emojiBarContent}>
            {QUICK_EMOJIS.map((em) => (
              <TouchableOpacity key={em} style={styles.emojiBtn} onPress={() => appendEmoji(em)}>
                <Text style={styles.emojiChar}>{em}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.composerRow}>
          {!editing ? (
            <View style={styles.composerLeading}>
              <TouchableOpacity
                style={styles.inlineToolBtn}
                onPressIn={keepComposerOpen}
                onPress={pickAttachment}
                disabled={sending}
                accessibilityLabel="Shto media"
              >
                <Text style={styles.inlinePlus}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineToolBtn, showEmojiBar && styles.inlineToolBtnActive]}
                onPressIn={keepComposerOpen}
                onPress={() => {
                  keepComposerOpen();
                  inputRef.current?.focus();
                  setShowEmojiBar((v) => !v);
                }}
                disabled={sending}
                accessibilityLabel="Emoji"
              >
                <Text style={styles.inlineEmoji}>😊</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TextInput
            ref={inputRef}
            style={[styles.input, editing && styles.inputEditingOnly]}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={editing ? 'Ndrysho tekstin…' : 'Shkruaj mesazhin…'}
            multiline
            editable={!sending}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (editing && sending) || !canSend ? styles.sendBtnDisabled : null]}
            onPress={onSend}
            disabled={(editing && sending) || !canSend}
            accessibilityLabel={editing ? 'Ruaj' : 'Dërgo'}
          >
            {editing && sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={editing ? 'checkmark' : 'send'} size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ForwardMessageModal
        visible={!!forwardMessage}
        message={forwardMessage}
        currentUserId={user?.id}
        onClose={() => setForwardMessage(null)}
      />
      <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
        <TouchableOpacity style={styles.imageModalBackdrop} activeOpacity={1} onPress={() => setPreviewImageUri(null)}>
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.imageModalImage} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
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
  msgAvatarSpacing: { marginRight: 8 },
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
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  msgTime: {
    fontSize: 10,
    color: '#64748b',
  },
  msgTimeMine: { color: 'rgba(255,255,255,0.85)' },
  statusIcon: { marginLeft: 2 },
  statusSpinner: { marginLeft: 4 },
  typingBar: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  typingText: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  mediaWrap: { marginBottom: 6, borderRadius: 10, overflow: 'hidden' },
  msgImage: { width: 200, height: 200, maxWidth: '100%', backgroundColor: '#e2e8f0' },
  msgVideo: { width: 220, height: 160, marginBottom: 6, backgroundColor: '#000' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, maxWidth: 220 },
  fileName: { flex: 1, color: '#0f766e', fontWeight: '600', fontSize: 14 },
  fileNameMine: { color: '#e0f2f1' },
  bubbleTextAfterMedia: { marginTop: 4 },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: '#0f766e',
    paddingLeft: 8,
    marginBottom: 8,
    opacity: 0.95,
  },
  replyQuoteMine: { borderLeftColor: '#99f6e4' },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0f766e',
  },
  replyBannerBody: { flex: 1, marginRight: 8 },
  replyBannerLabel: { fontSize: 11, fontWeight: '700', color: '#0f766e', marginBottom: 6 },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  attachmentThumb: { width: 44, height: 44, borderRadius: 8 },
  attachmentThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: { flex: 1, color: '#334155', fontSize: 13 },
  emojiBar: { marginBottom: 8, maxHeight: 48 },
  emojiBarContent: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  emojiBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  emojiChar: { fontSize: 26 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  composerLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 4,
  },
  inlineToolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 6,
  },
  inlineToolBtnActive: {
    backgroundColor: '#ccfbf1',
    borderColor: '#0f766e',
  },
  inlinePlus: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f766e',
    lineHeight: 28,
    marginTop: -2,
  },
  inlineEmoji: { fontSize: 22 },
  input: {
    flex: 1,
    flexShrink: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  inputEditingOnly: { marginLeft: 0 },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0f766e',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
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
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalImage: { width: '100%', height: '80%' },
});
