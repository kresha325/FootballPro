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
} from '../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { openUserProfile } from '../utils/openUserProfile';
import {
  conversationDetailRequest,
  conversationsRequest,
  addGroupMembersRequest,
  leaveGroupRequest,
  conversationMessagesRequest,
  deleteMessageRequest,
  editMessageRequest,
  extractErrorMessage,
  markConversationReadRequest,
  searchConversationMessagesRequest,
  sendConversationMessageRequest,
  toggleMessageReactionRequest,
  blockUserRequest,
  removeGroupMemberRequest,
  setGroupMemberRoleRequest,
  transferGroupOwnerRequest,
  updateGroupRequest,
  userOnlineStatusRequest,
} from '../api/client';
import ReportSheet from '../components/ReportSheet';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BACKEND_URL, WEB_APP_URL } from '../config/constants';
import {
  messageBelongsToConversation,
  normalizeMessagePayload,
} from '../utils/messagingRealtime';
import { formatPresenceLabel } from '../utils/presenceLabel';
import ForwardMessageModal from '../components/messaging/ForwardMessageModal';
import MessageActionsSheet from '../components/messaging/MessageActionsSheet';
import ReplyPreview from '../components/messaging/ReplyPreview';
import { mergeOthersRead, outboundMessageStatus } from '../utils/messageStatus';
import * as Clipboard from 'expo-clipboard';
import { replyPreviewText } from '../utils/messageActions';

const QUICK_EMOJIS = ['⚽', '🔥', '😀', '😂', '👍', '❤️', '🎉', '👏', '🙌', '😮'];
const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '👏', '😮', '😢'];

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
  if (status === 'seen' || status === 'read') {
    return <Ionicons name="checkmark-done" size={15} color="#93c5fd" style={styles.statusIcon} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={15} color="rgba(255,255,255,0.75)" style={styles.statusIcon} />;
  }
  return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" style={styles.statusIcon} />;
}

function MessageBubble({ message, mine, onOpenActions, onOpenImage, outboundStatus, onOpenSenderProfile, isDark, onReact, onOpenReply, highlighted }) {
  const sender = message?.sender;
  const name = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'User';
  const deleted = !!message?.deleted;
  const avatarUri = !mine ? senderAvatarUrl(message) : null;
  const timeLabel = formatMessageTime(message?.createdAt);
  const fileUri = messageFileUrl(message);
  const hasText = !!(message?.content && String(message.content).trim());
  const openActions = !deleted ? onOpenActions : undefined;
  const [mediaBroken, setMediaBroken] = useState(false);

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
      <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={openActions}
          delayLongPress={350}
        >
          {!mine ? <Text style={[styles.sender, isDark && { color: '#94a3b8' }]}>{name}</Text> : null}
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleOther,
              !mine && isDark && styles.bubbleOtherDark,
              highlighted && { borderWidth: 2, borderColor: '#f59e0b' },
            ]}
          >
            {!deleted && message.replyTo ? (
              <TouchableOpacity onPress={() => onOpenReply?.(message.replyTo)} activeOpacity={0.8}>
                <View style={[styles.replyQuote, mine && styles.replyQuoteMine]}>
                  <ReplyPreview message={message.replyTo} mine={mine} />
                </View>
              </TouchableOpacity>
            ) : null}
            {!deleted && message.forwarded ? (
              <Text style={[styles.editedHint, mine && styles.editedHintMine]}>E përcjellë</Text>
            ) : null}
            {deleted ? (
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.deletedText]}>
                Mesazhi u fshi
              </Text>
            ) : (
              <>
                {fileUri && message.type === 'image' ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => !mediaBroken && onOpenImage?.(fileUri)}
                    onLongPress={openActions}
                    delayLongPress={350}
                    style={styles.mediaWrap}
                  >
                    {mediaBroken ? (
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>Media nuk u ngarkua</Text>
                    ) : (
                      <Image source={{ uri: fileUri }} style={styles.msgImage} resizeMode="cover" onError={() => setMediaBroken(true)} />
                    )}
                  </TouchableOpacity>
                ) : null}
                {fileUri && message.type === 'video' ? (
                  <Video
                    source={{ uri: fileUri }}
                    style={styles.msgVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isMuted={false}
                    volume={1}
                  />
                ) : null}
                {fileUri && message.type === 'file' ? (
                  <TouchableOpacity
                    style={styles.fileRow}
                    onPress={openFileLink}
                    onLongPress={openActions}
                    delayLongPress={350}
                  >
                    <Ionicons name="document-outline" size={22} color={mine ? '#e0f2f1' : '#9A6B12'} />
                    <Text style={[styles.fileName, mine && styles.fileNameMine]} numberOfLines={2}>
                      {message.fileName || 'Skedar'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {fileUri && !message.type ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => !mediaBroken && onOpenImage?.(fileUri)}
                    onLongPress={openActions}
                    delayLongPress={350}
                    style={styles.mediaWrap}
                  >
                    {mediaBroken ? (
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>Media nuk u ngarkua</Text>
                    ) : (
                      <Image source={{ uri: fileUri }} style={styles.msgImage} resizeMode="cover" onError={() => setMediaBroken(true)} />
                    )}
                  </TouchableOpacity>
                ) : null}
                {hasText && message.type !== 'call' ? (
                  <Text
                    style={[
                      styles.bubbleText,
                      mine && styles.bubbleTextMine,
                      !mine && isDark && styles.bubbleTextDark,
                      fileUri && styles.bubbleTextAfterMedia,
                    ]}
                  >
                    {message.content}
                  </Text>
                ) : null}
                {message.type === 'call' && message.content ? (
                  <Text style={[styles.callBubbleText, mine && styles.callBubbleTextMine]}>
                    {message.content}
                  </Text>
                ) : null}
              </>
            )}
            {!deleted && message?.edited ? (
              <Text style={[styles.editedHint, mine && styles.editedHintMine]}>(ndryshuar)</Text>
            ) : null}
            {!deleted && Array.isArray(message.reactions) && message.reactions.length > 0 ? (
              <View style={styles.reactionRow}>
                {message.reactions.map((reaction) => (
                  <TouchableOpacity key={reaction.emoji} onPress={() => onReact?.(reaction.emoji)}>
                    <Text style={styles.reactionChip}>{reaction.emoji} {reaction.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View style={styles.msgMetaRow}>
              {timeLabel ? (
                <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{timeLabel}</Text>
              ) : (
                <View />
              )}
              <View style={styles.metaRight}>
                <MessageStatusTicks status={outboundStatus} mine={mine} />
                {openActions ? (
                  <TouchableOpacity
                    onPress={openActions}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.moreBtn}
                    accessibilityLabel="Veprime mesazhi"
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={16}
                      color={mine ? 'rgba(255,255,255,0.9)' : '#64748b'}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
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
  const { colors, isDark } = useTheme();
  const [otherUserId, setOtherUserId] = useState(paramOtherUserId ?? null);
  const [isGroup, setIsGroup] = useState(!!paramIsGroup);
  const [peerTitle, setPeerTitle] = useState(paramTitle || '');
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState(null);

  useEffect(() => {
    if (paramTitle) setPeerTitle(paramTitle);
  }, [paramTitle]);

  useEffect(() => {
    if (paramOtherUserId != null) setOtherUserId(paramOtherUserId);
  }, [paramOtherUserId]);

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
  const [actionMessage, setActionMessage] = useState(null);
  const [reportMessage, setReportMessage] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [threadQuery, setThreadQuery] = useState('');
  const [searchHits, setSearchHits] = useState(null);
  const [groupOwnerId, setGroupOwnerId] = useState(null);
  const [myGroupRole, setMyGroupRole] = useState(null);
  const [othersRead, setOthersRead] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteContacts, setInviteContacts] = useState([]);
  const [inviteSelected, setInviteSelected] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [typingByUserId, setTypingByUserId] = useState({});
  const typingTimeoutRef = useRef(null);
  const composerBlurTimeoutRef = useRef(null);
  const emitStopTypingRef = useRef(() => {});
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    conversationDetailRequest(conversationId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        const group = !!data?.isGroup;
        setIsGroup(group);
        const members = Array.isArray(data?.members) ? data.members : [];
        if (group) {
          const name = data?.name || paramTitle || 'Grup';
          setPeerTitle(name);
          setGroupMembers(members);
          setGroupOwnerId(data?.ownerId ?? null);
          setMyGroupRole(data?.myRole || members.find((m) => Number(m.id) === Number(user?.id))?.memberRole || null);
          return;
        }
        setGroupMembers([]);
        if (user?.id == null) return;
        const other = members.find((m) => Number(m.id) !== Number(user.id));
        if (other?.id != null) {
          setOtherUserId(other.id);
          const name = `${other.firstName || ''} ${other.lastName || ''}`.trim();
          if (name) setPeerTitle(name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId, paramTitle, user?.id]);

  const refreshPeerPresence = useCallback(async (uid) => {
    if (uid == null) return;
    try {
      const res = await userOnlineStatusRequest(uid);
      setPeerOnline(!!res?.data?.online);
      setPeerLastSeen(res?.data?.lastSeenAt || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isGroup || otherUserId == null) return undefined;
    refreshPeerPresence(otherUserId);
    const t = setInterval(() => refreshPeerPresence(otherUserId), 45000);
    return () => clearInterval(t);
  }, [isGroup, otherUserId, refreshPeerPresence, socketConnected]);

  const openInvitePicker = useCallback(async () => {
    setInviteBusy(true);
    try {
      const res = await conversationsRequest();
      const list = Array.isArray(res?.data) ? res.data : [];
      const existingIds = new Set(groupMembers.map((m) => Number(m.id)));
      const map = new Map();
      list.forEach((conv) => {
        if (conv?.isGroup || !Array.isArray(conv?.members)) return;
        const other = conv.members.find((m) => Number(m.id) !== Number(user?.id));
        if (!other?.id || existingIds.has(Number(other.id)) || map.has(Number(other.id))) return;
        map.set(Number(other.id), {
          id: other.id,
          name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Përdorues',
          profilePhoto: other.profilePhoto || null,
        });
      });
      setInviteContacts(Array.from(map.values()));
      setInviteSelected([]);
      setShowInvitePicker(true);
    } catch (err) {
      Alert.alert('Ftesa', extractErrorMessage(err) || 'Nuk u ngarkuan kontaktet');
    } finally {
      setInviteBusy(false);
    }
  }, [groupMembers, user?.id]);

  const submitInvite = useCallback(async () => {
    if (!conversationId || inviteSelected.length === 0) return;
    setInviteBusy(true);
    try {
      const res = await addGroupMembersRequest(conversationId, inviteSelected);
      const members = Array.isArray(res?.data?.members) ? res.data.members : [];
      setGroupMembers(members);
      setShowInvitePicker(false);
      setInviteSelected([]);
      Alert.alert('Ftesa', 'Anëtarët u shtuan në grup.');
    } catch (err) {
      Alert.alert('Ftesa', extractErrorMessage(err) || 'Nuk u shtuan anëtarët');
    } finally {
      setInviteBusy(false);
    }
  }, [conversationId, inviteSelected]);

  const confirmLeaveGroup = useCallback(() => {
    if (!conversationId) return;
    Alert.alert('Dil nga grupi', 'Je i sigurt që do të dalësh nga ky grup?', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Dil',
        style: 'destructive',
        onPress: async () => {
          setLeaveBusy(true);
          try {
            await leaveGroupRequest(conversationId);
            setShowGroupMembers(false);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err) || 'Nuk u dal nga grupi');
          } finally {
            setLeaveBusy(false);
          }
        },
      },
    ]);
  }, [conversationId, navigation]);

  const openCall = useCallback(
    (audioOnly) => {
      if (isGroup) {
        if (!conversationId) {
          Alert.alert('Thirrje', 'Mungon ID e bisedës së grupit.');
          return;
        }
        navigation.navigate('GroupCall', {
          conversationId,
          title: peerTitle || paramTitle || 'Grup',
          audioOnly,
        });
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
    [isGroup, navigation, otherUserId, conversationId, peerTitle, paramTitle]
  );

  const headerName = useMemo(() => {
    if (isGroup) return peerTitle || paramTitle || 'Grup';
    return peerTitle || paramTitle || 'Bisedë';
  }, [isGroup, peerTitle, paramTitle]);

  const headerSubtitle = useMemo(() => {
    if (isGroup) {
      const names = groupMembers
        .map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
        .filter(Boolean);
      if (!names.length) return 'Shiko anëtarët';
      const shown = names.slice(0, 3).join(', ');
      return names.length > 3 ? `${shown}…` : shown;
    }
    const peerTyping = Object.keys(typingByUserId).some(
      (id) => Number(id) !== Number(user?.id) && Number(id) === Number(otherUserId)
    );
    return formatPresenceLabel({
      online: peerOnline,
      lastSeenAt: peerLastSeen,
      typing: peerTyping,
    });
  }, [isGroup, groupMembers, typingByUserId, user?.id, otherUserId, peerOnline, peerLastSeen]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: headerName,
      headerTitleAlign: 'center',
      headerTitle: () => (
        <TouchableOpacity
          activeOpacity={isGroup || otherUserId ? 0.7 : 1}
          onPress={() => {
            if (isGroup) {
              setShowGroupMembers(true);
              return;
            }
            if (otherUserId) openUserProfile(navigation, otherUserId);
          }}
          style={styles.headerTitleWrap}
          disabled={!isGroup && otherUserId == null}
        >
          <Text style={[styles.headerTitleName, { color: colors.text }]} numberOfLines={1}>
            {headerName}
          </Text>
          <View style={styles.headerSubtitleRow}>
            {!isGroup ? (
              <View
                style={[
                  styles.presenceDot,
                  { backgroundColor: peerOnline ? '#22c55e' : colors.muted },
                ]}
              />
            ) : null}
            <Text
              style={[
                styles.headerTitleSub,
                { color: peerOnline && !isGroup ? '#16a34a' : colors.muted },
              ]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          {(isGroup && conversationId) || (!isGroup && otherUserId) ? (
            <>
              {!isGroup && otherUserId ? (
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => {
                    Alert.alert('Blloko', 'Ky përdorues nuk do të mund të të shkruajë ose të të telefonojë.', [
                      { text: 'Anulo', style: 'cancel' },
                      {
                        text: 'Blloko',
                        style: 'destructive',
                        onPress: () => blockUserRequest(otherUserId).catch((err) => Alert.alert('Gabim', extractErrorMessage(err, 'Bllokimi dështoi'))),
                      },
                    ]);
                  }}
                  accessibilityLabel="Blloko"
                >
                  <Ionicons name="ban-outline" size={22} color="#dc2626" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => openCall(true)}
                accessibilityLabel="Thirrje audio"
              >
                <Ionicons name="call-outline" size={22} color="#9A6B12" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => openCall(false)}
                accessibilityLabel="Thirrje video"
              >
                <Ionicons name="videocam-outline" size={24} color="#9A6B12" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ),
    });
  }, [
    navigation,
    isGroup,
    otherUserId,
    conversationId,
    openCall,
    headerName,
    headerSubtitle,
    peerOnline,
    colors.text,
    colors.muted,
  ]);

  /** Rend kronologjik: më të vjetrit lart, më të rinjtë poshtë (pa `inverted` / pa scaleY). */
  const listData = useMemo(() => {
    const source = threadQuery.trim() ? (searchHits || []) : messages;
    const list = Array.isArray(source) ? [...source] : [];
    return list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      const na = Number.isNaN(ta) ? 0 : ta;
      const nb = Number.isNaN(tb) ? 0 : tb;
      return na - nb;
    });
  }, [messages, threadQuery, searchHits]);

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
      setMessages((prev) =>
        prev.map((m) => (m.id === mid ? { ...m, deleted: true, content: '' } : m))
      );
    };

    const typingTimers = {};
    const onUserTyping = ({ userId, userName, conversationId: typingConversationId }) => {
      if (typingConversationId != null && String(typingConversationId) !== String(conversationId)) return;
      if (userId == null || Number(userId) === Number(user?.id)) return;
      const key = String(userId);
      setTypingByUserId((prev) => ({ ...prev, [key]: userName || '…' }));
      if (typingTimers[key]) clearTimeout(typingTimers[key]);
      typingTimers[key] = setTimeout(() => {
        setTypingByUserId((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 4000);
    };

    const onUserStoppedTyping = ({ userId, conversationId: typingConversationId }) => {
      if (typingConversationId != null && String(typingConversationId) !== String(conversationId)) return;
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

    const onPresenceUpdate = (payload) => {
      if (payload?.userId == null || otherUserId == null) return;
      if (Number(payload.userId) !== Number(otherUserId)) return;
      setPeerOnline(!!payload.online);
      if (payload.lastSeenAt) setPeerLastSeen(payload.lastSeenAt);
      else if (payload.online) setPeerLastSeen(null);
    };

    const onReaction = (payload) => {
      if (String(payload?.conversationId) !== String(conversationId) || payload?.messageId == null) return;
      setMessages((prev) => prev.map((m) => (
        m.id === payload.messageId ? { ...m, reactions: payload.reactions || [] } : m
      )));
    };
    const onDelivered = (payload) => {
      if (String(payload?.conversationId) !== String(conversationId) || payload?.messageId == null) return;
      setMessages((prev) => prev.map((m) => (
        m.id === payload.messageId ? { ...m, deliveredAt: payload.deliveredAt || m.deliveredAt } : m
      )));
    };
    const syncAfterReconnect = () => {
      rejoinConversationRoom();
      conversationMessagesRequest(conversationId, { limit: 50, page: 1 })
        .then((response) => {
          const list = Array.isArray(response?.data?.messages) ? response.data.messages : [];
          setMessages((prev) => {
            const map = new Map(prev.map((m) => [String(m.id), m]));
            list.forEach((row) => map.set(String(row.id), { ...(map.get(String(row.id)) || {}), ...row }));
            return Array.from(map.values());
          });
          if (Array.isArray(response?.data?.othersRead)) setOthersRead(response.data.othersRead);
          markConversationReadRequest(conversationId).catch(() => {});
        })
        .catch(() => {});
    };
    if (ioMgr && typeof ioMgr.on === 'function') {
      ioMgr.on('reconnect', syncAfterReconnect);
    }

    socket.on('newMessage', onNewMessage);
    socket.on('messageUpdated', onMessageUpdated);
    socket.on('messageDeleted', onMessageDeleted);
    socket.on('messageReactionUpdated', onReaction);
    socket.on('messageDelivered', onDelivered);
    socket.on('userTyping', onUserTyping);
    socket.on('userStoppedTyping', onUserStoppedTyping);
    socket.on('conversationRead', onConversationRead);
    socket.on('presence:update', onPresenceUpdate);

    return () => {
      socket.off('connect', rejoinConversationRoom);
      if (ioMgr && typeof ioMgr.off === 'function') {
        ioMgr.off('reconnect', syncAfterReconnect);
      }
      socket.off('newMessage', onNewMessage);
      socket.off('messageUpdated', onMessageUpdated);
      socket.off('messageDeleted', onMessageDeleted);
      socket.off('messageReactionUpdated', onReaction);
      socket.off('messageDelivered', onDelivered);
      socket.off('userTyping', onUserTyping);
      socket.off('userStoppedTyping', onUserStoppedTyping);
      socket.off('conversationRead', onConversationRead);
      socket.off('presence:update', onPresenceUpdate);
      emitStopTypingRef.current();
      socket.emit('leaveConversation', roomId);
    };
  }, [conversationId, getSocket, socketConnected, user?.id, otherUserId]);

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
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, deleted: true, content: '' } : m))
            );
          } catch (err) {
            setError(extractErrorMessage(err, 'Nuk u fshi mesazhi'));
          }
        },
      },
    ]);
  };

  const copyMessageText = useCallback(async (message) => {
    const text = (message?.content && String(message.content).trim()) || replyPreviewText(message);
    if (!text) {
      Alert.alert('Kopjo', 'Ky mesazh nuk ka tekst për të kopjuar.');
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS === 'android') {
        // ToastAndroid not always imported; Alert is fine
      }
      Alert.alert('Kopjuar', 'Teksti u kopjua.');
    } catch (err) {
      Alert.alert('Kopjo', extractErrorMessage(err, 'Nuk u kopjua teksti'));
    }
  }, []);

  const openMessageActions = useCallback((message) => {
    if (!message || message.deleted) return;
    setActionMessage(message);
  }, []);

  const toggleReaction = useCallback(async (message, emoji) => {
    if (!message?.id || String(message.id).startsWith('pending')) return;
    try {
      const { data } = await toggleMessageReactionRequest(message.id, emoji);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: data?.reactions || [] } : m)));
    } catch (err) {
      setError(extractErrorMessage(err, 'Reagimi nuk u ruajt'));
    }
  }, []);

  const openReplyTarget = useCallback((reply) => {
    if (!reply?.id || reply.deleted || reply.unavailable) {
      setError('Mesazhi origjinal nuk është i disponueshëm');
      return;
    }
    const index = listData.findIndex((m) => String(m.id) === String(reply.id));
    if (index < 0) {
      setError('Mesazhi origjinal nuk është në këtë faqe. Ngarko mesazhe më të vjetra.');
      return;
    }
    listRef.current?.scrollToIndex({ index, viewPosition: 0.4 });
    setHighlightId(reply.id);
    setTimeout(() => setHighlightId((current) => (current === reply.id ? null : current)), 1600);
  }, [listData]);

  useEffect(() => {
    const q = threadQuery.trim();
    if (!conversationId || !q) {
      setSearchHits(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      searchConversationMessagesRequest(conversationId, { q, page: 1, limit: 30 })
        .then((response) => setSearchHits(response?.data?.messages || []))
        .catch(() => {
          setSearchHits([]);
          setError('Kërkimi dështoi');
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [threadQuery, conversationId]);

  const canManageGroup = isGroup && (Number(groupOwnerId) === Number(user?.id) || myGroupRole === 'admin');

  const manageMember = (member) => {
    if (!canManageGroup || Number(member?.id) === Number(user?.id)) return;
    if (groupOwnerId != null && Number(member.id) === Number(groupOwnerId)) return;
    const buttons = [
      member.memberRole === 'admin'
        ? { text: 'Hiq admin', onPress: () => setGroupMemberRoleRequest(conversationId, member.id, 'member').then((res) => setGroupMembers(res.data?.members || groupMembers)).catch((err) => setError(extractErrorMessage(err, 'Roli nuk u ndryshua'))) }
        : { text: 'Bëj admin', onPress: () => setGroupMemberRoleRequest(conversationId, member.id, 'admin').then((res) => setGroupMembers(res.data?.members || groupMembers)).catch((err) => setError(extractErrorMessage(err, 'Roli nuk u ndryshua'))) },
      { text: 'Hiq nga grupi', style: 'destructive', onPress: () => removeGroupMemberRequest(conversationId, member.id).then((res) => setGroupMembers(res.data?.members || [])).catch((err) => setError(extractErrorMessage(err, 'Anëtari nuk u hoq'))) },
    ];
    if (Number(groupOwnerId) === Number(user?.id) || groupOwnerId == null) {
      buttons.unshift({
        text: 'Transfero pronësinë',
        onPress: () => transferGroupOwnerRequest(conversationId, member.id)
          .then((res) => {
            setGroupOwnerId(res.data?.ownerId ?? member.id);
            setGroupMembers(res.data?.members || groupMembers);
          })
          .catch((err) => setError(extractErrorMessage(err, 'Pronësia nuk u transferua'))),
      });
    }
    buttons.push({ text: 'Anulo', style: 'cancel' });
    Alert.alert(member.firstName || 'Anëtar', 'Zgjidh veprimin', buttons);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bgElevated }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
      style={[styles.container, { backgroundColor: colors.bgElevated }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        value={threadQuery}
        onChangeText={setThreadQuery}
        placeholder="Kërko në bisedë"
        placeholderTextColor={colors.muted}
        style={[styles.threadSearch, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />
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
            colors={[isDark ? '#D9A441' : '#9A6B12']}
            tintColor={isDark ? '#D9A441' : '#9A6B12'}
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
        onScroll={(event) => {
          if (threadQuery.trim()) return;
          if (event.nativeEvent.contentOffset.y < 48) loadOlder();
        }}
        scrollEventThrottle={80}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          });
        }}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={isMineMessage(item, user?.id)}
            outboundStatus={outboundMessageStatus(item, othersRead, user?.id)}
            onOpenActions={() => openMessageActions(item)}
            onOpenImage={setPreviewImageUri}
            onOpenSenderProfile={(uid) => openUserProfile(navigation, uid)}
            onReact={(emoji) => toggleReaction(item, emoji)}
            onOpenReply={openReplyTarget}
            highlighted={highlightId != null && String(highlightId) === String(item.id)}
            isDark={isDark}
          />
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>Ende nuk ka mesazhe.</Text>}
      />
      {typingLine ? (
        <View
          style={[
            styles.typingBar,
            { backgroundColor: colors.bg, borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.typingText, { color: colors.muted }]}>{typingLine}</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.composer,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
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
                <Ionicons name="videocam" size={28} color="#9A6B12" />
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
            style={[
              styles.input,
              editing && styles.inputEditingOnly,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={editing ? 'Ndrysho tekstin…' : 'Shkruaj mesazhin…'}
            placeholderTextColor={colors.mutedSoft}
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
      <ReportSheet
        visible={!!reportMessage}
        onClose={() => setReportMessage(null)}
        targetType="message"
        targetId={reportMessage?.id}
      />
      <MessageActionsSheet
        visible={!!actionMessage}
        message={actionMessage}
        mine={isMineMessage(actionMessage, user?.id)}
        colors={colors}
        onClose={() => setActionMessage(null)}
        onReply={(msg) => {
          if (!msg) return;
          setReplyTo(msg);
          setEditing(null);
          setShowEmojiBar(false);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onForward={(msg) => {
          if (msg) setForwardMessage(msg);
        }}
        onCopy={(msg) => {
          if (msg) copyMessageText(msg);
        }}
        onEdit={(msg) => {
          if (!msg) return;
          setReplyTo(null);
          setEditing({ id: msg.id, text: msg.content || '' });
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onReport={(msg) => {
          if (msg) setReportMessage(msg);
        }}
        onDelete={(msg) => {
          if (msg?.id != null) confirmDelete(msg.id);
        }}
      />
      <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
        <TouchableOpacity style={styles.imageModalBackdrop} activeOpacity={1} onPress={() => setPreviewImageUri(null)}>
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.imageModalImage} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showGroupMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGroupMembers(false)}
      >
        <View style={styles.membersModalRoot}>
          <TouchableOpacity
            style={styles.membersModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowGroupMembers(false)}
          />
          <View style={[styles.membersModalCard, { backgroundColor: colors.card }]}>
            <View style={styles.membersModalHeader}>
              <Text style={[styles.membersModalTitle, { color: colors.text }]}>
                Anëtarët ({groupMembers.length})
              </Text>
              <TouchableOpacity onPress={() => setShowGroupMembers(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {canManageGroup ? (
              <View style={[styles.membersActions, { paddingBottom: 0 }]}>
                <TextInput
                  placeholder="Emër i ri i grupit"
                  placeholderTextColor={colors.muted}
                  style={[styles.threadSearch, { flex: 1, marginHorizontal: 0, color: colors.text, borderColor: colors.border }]}
                  onSubmitEditing={(event) => {
                    const name = event.nativeEvent.text?.trim();
                    if (!name) return;
                    updateGroupRequest(conversationId, { name })
                      .then((res) => {
                        setPeerTitle(res.data?.name || name);
                        setGroupOwnerId(res.data?.ownerId ?? groupOwnerId);
                      })
                      .catch((err) => setError(extractErrorMessage(err, 'Emri nuk u ndryshua')));
                  }}
                />
              </View>
            ) : null}
            <View style={styles.membersActions}>
              <TouchableOpacity
                style={[styles.membersActionBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}
                onPress={openInvitePicker}
                disabled={inviteBusy || leaveBusy}
              >
                {inviteBusy && !showInvitePicker ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color={colors.primaryText} />
                    <Text style={[styles.membersActionText, { color: colors.primaryText }]}>Fto anëtarë</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.membersActionBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder || colors.danger }]}
                onPress={confirmLeaveGroup}
                disabled={leaveBusy || inviteBusy}
              >
                {leaveBusy ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="exit-outline" size={18} color={colors.danger} />
                    <Text style={[styles.membersActionText, { color: colors.danger }]}>Dil nga grupi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <FlatList
              data={groupMembers}
              keyExtractor={(item, index) => String(item?.id ?? index)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.membersEmpty, { color: colors.muted }]}>Nuk ka anëtarë.</Text>
              }
              renderItem={({ item }) => {
                const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Përdorues';
                const isMe = Number(item.id) === Number(user?.id);
                const memberRole = item.memberRole || null;
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      if (item?.id == null) return;
                      setShowGroupMembers(false);
                      openUserProfile(navigation, item.id);
                    }}
                    onLongPress={() => manageMember(item)}
                    disabled={item?.id == null}
                  >
                    <UserAvatar
                      uri={item.profilePhoto || null}
                      user={item}
                      size={40}
                      style={styles.memberAvatar}
                    />
                    <View style={styles.memberMeta}>
                      <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                        {name}
                        {isMe ? ' (ti)' : ''}
                      </Text>
                      {memberRole ? (
                        <Text style={[styles.memberRole, { color: colors.muted }]} numberOfLines={1}>
                          {memberRole === 'admin' ? 'Admin' : 'Anëtar'}
                        </Text>
                      ) : item.role ? (
                        <Text style={[styles.memberRole, { color: colors.muted }]} numberOfLines={1}>
                          {item.role}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedSoft || colors.muted} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={showInvitePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvitePicker(false)}
      >
        <View style={styles.membersModalRoot}>
          <TouchableOpacity
            style={styles.membersModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowInvitePicker(false)}
          />
          <View style={[styles.membersModalCard, { backgroundColor: colors.card }]}>
            <View style={styles.membersModalHeader}>
              <Text style={[styles.membersModalTitle, { color: colors.text }]}>Fto anëtarë</Text>
              <TouchableOpacity onPress={() => setShowInvitePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.inviteHint, { color: colors.muted }]}>
              Zgjidh nga kontaktet e tua (biseda 1-1).
            </Text>
            <FlatList
              data={inviteContacts}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.membersEmpty, { color: colors.muted }]}>
                  Nuk ka kontakte të reja për ftesë. Fillo biseda 1-1 fillimisht.
                </Text>
              }
              renderItem={({ item }) => {
                const selected = inviteSelected.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setInviteSelected((prev) =>
                        selected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                      );
                    }}
                  >
                    <UserAvatar uri={item.profilePhoto} user={item} size={40} style={styles.memberAvatar} />
                    <Text style={[styles.memberName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primaryText : colors.muted}
                    />
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={[
                styles.inviteSubmitBtn,
                { backgroundColor: colors.primary, opacity: inviteSelected.length ? 1 : 0.45 },
              ]}
              disabled={!inviteSelected.length || inviteBusy}
              onPress={submitInvite}
            >
              {inviteBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.inviteSubmitText}>
                  Shto {inviteSelected.length ? `(${inviteSelected.length})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerTitleWrap: {
    maxWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerTitleName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    gap: 5,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerTitleSub: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
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
  bubbleMine: { backgroundColor: '#9A6B12' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleOtherDark: { backgroundColor: '#1e293b', borderColor: '#334155' },
  bubbleText: { color: '#111827' },
  bubbleTextDark: { color: '#f8fafc' },
  bubbleTextMine: { color: '#fff' },
  callBubbleText: { color: '#9A6B12', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  callBubbleTextMine: { color: '#ccfbf1', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  deletedText: { fontStyle: 'italic', opacity: 0.85 },
  editedHint: { fontSize: 10, color: '#64748b', marginTop: 4 },
  editedHintMine: { color: '#e0f2f1' },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moreBtn: {
    paddingHorizontal: 2,
    paddingVertical: 2,
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
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  reactionChip: { fontSize: 12 },
  msgVideo: { width: 220, height: 160, marginBottom: 6, backgroundColor: '#000' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, maxWidth: 220 },
  fileName: { flex: 1, color: '#9A6B12', fontWeight: '600', fontSize: 14 },
  fileNameMine: { color: '#e0f2f1' },
  bubbleTextAfterMedia: { marginTop: 4 },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: '#9A6B12',
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
    borderLeftColor: '#9A6B12',
  },
  replyBannerBody: { flex: 1, marginRight: 8 },
  replyBannerLabel: { fontSize: 11, fontWeight: '700', color: '#9A6B12', marginBottom: 6 },
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
    borderColor: '#9A6B12',
  },
  inlinePlus: {
    fontSize: 26,
    fontWeight: '700',
    color: '#9A6B12',
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
    backgroundColor: '#9A6B12',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 28 },
  error: { color: '#b91c1c', textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  threadSearch: { marginHorizontal: 12, marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  loadOlder: { alignSelf: 'center', marginVertical: 10, paddingVertical: 8, paddingHorizontal: 14 },
  loadOlderText: { color: '#9A6B12', fontWeight: '600', fontSize: 13 },
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
  editBannerCancel: { color: '#9A6B12', fontWeight: '700' },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalImage: { width: '100%', height: '80%' },
  membersModalRoot: { flex: 1, justifyContent: 'flex-end' },
  membersModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  membersModalCard: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  membersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  membersModalTitle: { fontSize: 18, fontWeight: '800' },
  membersActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  membersActionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  membersActionText: { fontSize: 13, fontWeight: '700' },
  inviteHint: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13, lineHeight: 18 },
  inviteSubmitBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  inviteSubmitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  membersEmpty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberAvatar: { marginRight: 12 },
  memberMeta: { flex: 1, minWidth: 0, paddingRight: 8 },
  memberName: { fontSize: 16, fontWeight: '700' },
  memberRole: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
});
