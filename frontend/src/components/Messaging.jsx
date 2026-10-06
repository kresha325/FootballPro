import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLocation, Link } from 'react-router-dom';
import api from '../services/api';
import { FiPhone, FiVideo, FiSearch, FiSmile, FiChevronDown, FiUsers } from 'react-icons/fi';
import VideoCallSimple from './VideoCallSimple';
import GroupLiveKitCall from './GroupLiveKitCall';
import ForwardButton from './ForwardButton';
import VerifiedBadge from './VerifiedBadge';

import { API_URL, BACKEND_URL } from '../config/api';
import { outboundChatStatus, replyUnavailable } from '../utils/messagePresentation';

const QUICK_EMOJIS = ['⚽', '🔥', '😀', '😂', '👍', '❤️', '🎉', '👏', '🙌', '😮'];
const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '👏', '😮', '😢'];
const REPORT_REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Ngacmim'],
  ['inappropriate', 'Përmbajtje e papërshtatshme'],
  ['scam', 'Mashtrim'],
  ['other', 'Tjetër'],
];

function ChatMedia({ src, kind, alt, onOpen }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="text-xs italic opacity-80">Media nuk u ngarkua</span>;
  }
  if (kind === 'video') {
    return (
      <video
        src={src}
        controls
        className="max-w-xs rounded mb-2"
        onError={() => setBroken(true)}
        onClick={() => onOpen?.(src)}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt || 'Shared'}
      className="rounded mb-2 cursor-pointer max-w-[180px] max-h-[180px] object-cover border border-gray-300"
      onError={() => setBroken(true)}
      onClick={() => onOpen?.(src)}
    />
  );
}

function Linkify({ text, className, linkClassName }) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  const linkCls = linkClassName || 'underline break-all opacity-95 hover:opacity-100';
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function dayKey(d) {
  if (d == null) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
}

function dayDividerLabel(d) {
  const messageDate = new Date(d);
  if (Number.isNaN(messageDate.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(messageDate) === dayKey(today)) return 'Sot';
  if (dayKey(messageDate) === dayKey(yesterday)) return 'Dje';
  return messageDate.toLocaleDateString('sq-AL', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

// Modal për shfaqjen e fotove të mëdha
function MediaModal({ src, alt, onClose }) {
  const isVideo = typeof src === 'string' && /\.(mp4|mov|webm|avi)$/i.test(src);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={onClose}>
      <div className="relative" onClick={e => e.stopPropagation()}>
        {isVideo ? (
          <video src={src} controls className="max-h-[90vh] max-w-[90vw] rounded shadow-lg border-4 border-white" />
        ) : (
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded shadow-lg border-4 border-white"
          />
        )}
        <a
          href={src}
          download
          className="absolute top-2 right-2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 px-4 py-2 rounded shadow border border-gray-300 text-sm font-semibold transition"
          onClick={e => e.stopPropagation()}
        >
          Save
        </a>
      </div>
    </div>
  );
}

function Messaging() {
  // All useState declarations at the top
  const [modalImage, setModalImage] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({}); // { [userId]: true/false }
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' or 'audio'
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupMembersPanel, setShowGroupMembersPanel] = useState(false);
  const [showInviteMembersPanel, setShowInviteMembersPanel] = useState(false);
  const [inviteMemberIds, setInviteMemberIds] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [messagePagination, setMessagePagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [othersRead, setOthersRead] = useState([]);
  const [actionError, setActionError] = useState('');
  const [searchHits, setSearchHits] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reactionMenuId, setReactionMenuId] = useState(null);
  const [groupRename, setGroupRename] = useState('');
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const loadingOlderRef = useRef(false);
  const typingClearRef = useRef({});
  const lastTypingEmitRef = useRef(0);

  const { user } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  // Lexo userId dhe conversationId nga query me URLSearchParams
  const query = new URLSearchParams(location.search);
  const userId = query.get('userId');
  const conversationId = query.get('conversationId');

  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    if (/(^|\/)default-avatar\.png$/i.test(normalized)) return '/default-avatar.svg';
    const base = (BACKEND_URL || '').replace(/\/$/, '');
    const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `${base}${path}`;
  };

  const getOtherMember = (conversation) => {
    if (!conversation) {
      return { name: 'Unknown', profilePhoto: '', id: null, members: [], memberLabel: '' };
    }
    if (conversation.isGroup) {
      const members = Array.isArray(conversation.members) ? conversation.members : [];
      const names = members
        .map((m) => `${m.firstName || ''} ${m.lastName || ''}`.trim())
        .filter(Boolean);
      const shown = names.slice(0, 3).join(', ');
      return {
        name: conversation.name || 'Group Chat',
        profilePhoto: conversation.avatar,
        id: null,
        members,
        memberLabel: names.length
          ? names.length > 3
            ? `${shown}…`
            : shown
          : 'Shiko anëtarët',
      };
    }
    if (!conversation.members || !Array.isArray(conversation.members)) {
      return { name: 'Unknown', profilePhoto: '', id: null, members: [], memberLabel: '' };
    }
    const otherMember = conversation.members.find(
      (m) => Number(m.id) !== Number(user?.id)
    );
    if (!otherMember) {
      return { name: 'Unknown', profilePhoto: '', id: null, members: [], memberLabel: '' };
    }
    return {
      name: `${otherMember.firstName || ''} ${otherMember.lastName || ''}`.trim() || 'Unknown',
      profilePhoto:
        otherMember.profilePhoto ||
        otherMember.Profile?.profilePhoto ||
        '',
      id: otherMember.id || null,
      role: otherMember.role || null,
      club: otherMember.Profile?.club || otherMember.club || null,
      members: [],
      memberLabel: '',
    };
  };

  const formatTime = (date) => {
    if (date == null) return '';
    const messageDate = new Date(date);
    if (Number.isNaN(messageDate.getTime())) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const filteredConversations = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(conv => {
      const other = getOtherMember(conv);
      return (other.name || '').toLowerCase().includes(q);
    });
  }, [conversations, conversationSearch, user?.id]);

  const displayedMessages = useMemo(() => {
    if (threadSearch.trim()) return searchHits || [];
    return messages;
  }, [messages, threadSearch, searchHits]);

  const myGroupRole = selectedConversation?.memberships?.[0]?.role || selectedConversation?.myRole || null;
  const isGroupOwner = Number(selectedConversation?.ownerId) === Number(user?.id);
  const canManageGroup = !!(selectedConversation?.isGroup && (isGroupOwner || myGroupRole === 'admin'));

  // Ngarko bisedat sapo hapet komponenti
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch online status for all conversation members
  useEffect(() => {
    const fetchOnlineStatus = async () => {
      const statusObj = {};
      for (const conv of conversations) {
        // Only check for 1-1 conversations
        if (!conv.isGroup) {
          const other = conv.members.find((m) => Number(m.id) !== Number(user.id));
          if (other && other.id) {
            try {
              const res = await api.get(`/users/${other.id}/online`);
              statusObj[other.id] = !!res.data?.online;
            } catch {
              statusObj[other.id] = false;
            }
          }
        }
      }
      setOnlineStatus(statusObj);
    };
    if (conversations.length && user) fetchOnlineStatus();
  }, [conversations, user]);

  // Auto-open conversation if userId or conversationId is in query
  useEffect(() => {
    if (conversationId && conversations.length > 0 && !selectedConversation) {
      // Hap bisedën sipas conversationId
      const conv = conversations.find(c => c.id === conversationId || c.id === parseInt(conversationId));
      if (conv) {
        setSelectedConversation(conv);
      } else {
        // Merr bisedën nga backend nëse nuk është në listë
        api.get(`/messaging/conversations/detail/${conversationId}`)
          .then(res => {
            if (res.data && res.data.id) {
              setSelectedConversation(res.data);
              setConversations(prev => {
                if (prev.some(c => c.id === res.data.id)) return prev;
                return [res.data, ...prev];
              });
            }
          })
          .catch(err => {
            console.error('[Messaging] Error fetching conversation by id:', err);
          });
      }
    } else if (userId && conversations.length > 0 && !selectedConversation) {
      // Kontrollo nëse ekziston biseda
      const existing = conversations.find(c => c.members.some(m => m.id === parseInt(userId)));
      if (existing) {
        setSelectedConversation(existing);
      } else {
        // Krijo ose merr bisedën nga backend
        api.get(`/messaging/conversations/user/${userId}`)
          .then(res => {
            if (res.data && res.data.id) {
              setSelectedConversation(res.data);
              setConversations(prev => {
                if (prev.some(c => c.id === res.data.id)) return prev;
                return [res.data, ...prev];
              });
            }
          })
          .catch(err => {
            console.error('[Messaging] Auto-open conversation error:', err);
          });
      }
    } else if (!userId && !conversationId && conversations.length > 0 && !selectedConversation) {
      // Asnjë query param, zgjidh automatikisht të parën
      setSelectedConversation(conversations[0]);
    }
  }, [location.state, location.search, conversations, conversationId, userId, selectedConversation]);

  useEffect(() => {
    setThreadSearch('');
    setEditingMessage(null);
    setShowEmojiBar(false);
    setMessagePagination({ page: 1, pages: 1, total: 0 });
  }, [selectedConversation?.id]);

  useEffect(() => {
    setShowGroupMembersPanel(false);
    setShowInviteMembersPanel(false);
    setInviteMemberIds([]);
  }, [selectedConversation?.id]);

  async function inviteMembersToGroup() {
    if (!selectedConversation?.id || inviteMemberIds.length === 0) return;
    setInviteBusy(true);
    try {
      const res = await api.post(`/messaging/conversations/${selectedConversation.id}/members`, {
        memberIds: inviteMemberIds,
      });
      if (res?.data?.id) {
        setSelectedConversation(res.data);
        setConversations((prev) =>
          prev.map((c) => (Number(c.id) === Number(res.data.id) ? { ...c, ...res.data } : c))
        );
      }
      setShowInviteMembersPanel(false);
      setInviteMemberIds([]);
    } catch (err) {
      alert(err?.response?.data?.msg || 'Nuk u shtuan anëtarët');
    } finally {
      setInviteBusy(false);
    }
  }

  async function leaveSelectedGroup() {
    if (!selectedConversation?.id || !selectedConversation.isGroup) return;
    if (!window.confirm('Je i sigurt që do të dalësh nga ky grup?')) return;
    setLeaveBusy(true);
    try {
      await api.post(`/messaging/conversations/${selectedConversation.id}/leave`);
      const leftId = selectedConversation.id;
      setShowGroupMembersPanel(false);
      setSelectedConversation(null);
      setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(leftId)));
    } catch (err) {
      alert(err?.response?.data?.msg || 'Nuk u dal nga grupi');
    } finally {
      setLeaveBusy(false);
    }
  }

  useEffect(() => {
    if (socket) {
      socket.on('newMessage', handleNewMessage);
      socket.on('messageUpdated', handleMessageUpdated);
      socket.on('messageDeleted', handleMessageDeleted);
      socket.on('userTyping', handleUserTyping);
      socket.on('userStoppedTyping', handleUserStoppedTyping);
      socket.on('conversationRead', handleConversationRead);
      socket.on('messageRead', handleConversationRead);
      socket.on('messageDelivered', handleMessageDelivered);
      socket.on('messageReactionUpdated', handleReactionUpdated);
      socket.on('conversationUpdated', handleConversationUpdated);

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.off('messageUpdated', handleMessageUpdated);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStoppedTyping', handleUserStoppedTyping);
        socket.off('conversationRead', handleConversationRead);
        socket.off('messageRead', handleConversationRead);
        socket.off('messageDelivered', handleMessageDelivered);
        socket.off('messageReactionUpdated', handleReactionUpdated);
        socket.off('conversationUpdated', handleConversationUpdated);
      };
    }
  }, [socket, selectedConversation]);

  useEffect(() => {
    if (!socket || !selectedConversation?.id) return undefined;
    const sync = () => {
      socket.emit('joinConversation', selectedConversation.id);
      api.get(`/messaging/conversations/${selectedConversation.id}/messages`, {
        params: { page: 1, limit: 50 },
      }).then((response) => {
        const rows = response.data?.messages || [];
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [String(m.id), m]));
          rows.forEach((row) => {
            map.set(String(row.id), { ...(map.get(String(row.id)) || {}), ...row });
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        if (Array.isArray(response.data?.othersRead)) setOthersRead(response.data.othersRead);
        api.put(`/messaging/conversations/${selectedConversation.id}/read`).catch(() => {});
      }).catch(() => {
        setActionError('Lidhja u rikthye, por mesazhet nuk u sinkronizuan. Provo përsëri.');
      });
      fetchConversations();
    };
    const manager = socket.io;
    if (manager?.on) manager.on('reconnect', sync);
    return () => {
      if (manager?.off) manager.off('reconnect', sync);
    };
  }, [socket, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return undefined;
    const q = threadSearch.trim();
    if (!q) {
      setSearchHits(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api.get(`/messaging/conversations/${selectedConversation.id}/messages/search`, {
        params: { q, page: 1, limit: 30 },
      }).then((response) => {
        setSearchHits(response.data?.messages || []);
      }).catch(() => {
        setSearchHits([]);
        setActionError('Kërkimi dështoi. Provo përsëri.');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [threadSearch, selectedConversation?.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      if (socket) {
        socket.emit('joinConversation', selectedConversation.id);
      }

      return () => {
        if (socket) {
          socket.emit('leaveConversation', selectedConversation.id);
        }
      };
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/messaging/conversations');
      setConversations(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Fetch conversations error:', err);
      setLoading(false);
    }
  };

  const scrollToBottom = (instant) => {
    const run = () => messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    if (instant) run();
    else requestAnimationFrame(run);
  };

  const fetchMessages = async (cid) => {
    try {
      const response = await api.get(`/messaging/conversations/${cid}/messages`, {
        params: { page: 1, limit: 50 },
      });
      const { messages: rows, page, pages, total, othersRead: readRows } = response.data;
      setMessages(rows || []);
      setOthersRead(Array.isArray(readRows) ? readRows : []);
      setMessagePagination({ page: page || 1, pages: pages || 1, total: total || 0 });
      await api.put(`/messaging/conversations/${cid}/read`);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === cid || conv.id === Number(cid) ? { ...conv, unreadCount: 0 } : conv
        )
      );
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedConversation || loadingOlder) return;
    const { page, pages } = messagePagination;
    if (page >= pages) return;
    const el = messagesListRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    const nextPage = page + 1;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const response = await api.get(
        `/messaging/conversations/${selectedConversation.id}/messages`,
        { params: { page: nextPage, limit: 50 } }
      );
      const { messages: rows, page: newPage, pages: newPages, total } = response.data;
      setMessages(prev => [...(rows || []), ...prev]);
      setMessagePagination({ page: newPage, pages: newPages, total: total || 0 });
      requestAnimationFrame(() => {
        const node = messagesListRef.current;
        if (node) {
          node.scrollTop = prevScrollTop + (node.scrollHeight - prevScrollHeight);
        }
        loadingOlderRef.current = false;
      });
    } catch (err) {
      console.error('Load older messages error:', err);
      loadingOlderRef.current = false;
    } finally {
      setLoadingOlder(false);
    }
  };

  const placeConversationFirst = (message, unreadDelta) => {
    if (message?.conversationId == null) return;
    setConversations((prev) => {
      const cid = String(message.conversationId);
      const idx = prev.findIndex((conv) => String(conv.id) === cid);
      if (idx < 0) {
        fetchConversations();
        return prev;
      }
      const current = prev[idx];
      const preview = message.deleted
        ? 'Mesazh i fshirë'
        : (message.content || message.fileName || (message.type === 'image' ? 'Foto' : 'Media'));
      const updated = {
        ...current,
        lastMessage: preview,
        lastMessageAt: message.createdAt || new Date().toISOString(),
        unreadCount: Math.max(0, (current.unreadCount || 0) + unreadDelta),
      };
      return [updated, ...prev.filter((_, i) => i !== idx)];
    });
  };

  const handleNewMessage = (message) => {
    const mine = Number(message?.senderId || message?.sender?.id) === Number(user?.id);
    if (
      selectedConversation &&
      message &&
      String(message.conversationId) === String(selectedConversation.id)
    ) {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (!mine) {
        api.put(`/messaging/conversations/${selectedConversation.id}/read`).catch(() => {});
      }
      placeConversationFirst(message, 0);
      if (!loadingOlderRef.current) {
        requestAnimationFrame(() => scrollToBottom(false));
      }
    } else if (message?.conversationId != null) {
      placeConversationFirst(message, mine ? 0 : 1);
      if (!mine && message.id) {
        socket?.emit('messageDeliveredAck', { messageId: message.id, conversationId: message.conversationId });
      }
    }
  };

  const handleMessageUpdated = (payload) => {
    const convId = payload?.conversationId;
    const msg = payload?.message;
    if (!convId || !msg?.id) return;
    if (selectedConversation && String(selectedConversation.id) === String(convId)) {
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, ...msg } : m)));
    }
  };

  const handleMessageDeleted = (payload) => {
    const convId = payload?.conversationId;
    const mid = payload?.messageId;
    if (!convId || mid == null) return;
    if (selectedConversation && String(selectedConversation.id) === String(convId)) {
      setMessages(prev => prev.filter(m => m.id !== mid));
    }
  };

  const handleUserTyping = ({ userId: typingUserId, userName, conversationId: cid }) => {
    if (cid != null && selectedConversation && String(cid) !== String(selectedConversation.id)) return;
    if (Number(typingUserId) === Number(user?.id)) return;
    setTypingUsers(prev => ({ ...prev, [typingUserId]: userName || 'Dikush' }));
    if (typingClearRef.current[typingUserId]) clearTimeout(typingClearRef.current[typingUserId]);
    typingClearRef.current[typingUserId] = setTimeout(() => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[typingUserId];
        return next;
      });
    }, 4000);
  };

  const handleUserStoppedTyping = ({ userId: typingUserId, conversationId: cid }) => {
    if (cid != null && selectedConversation && String(cid) !== String(selectedConversation.id)) return;
    if (typingClearRef.current[typingUserId]) clearTimeout(typingClearRef.current[typingUserId]);
    setTypingUsers(prev => {
      const newTyping = { ...prev };
      delete newTyping[typingUserId];
      return newTyping;
    });
  };

  const handleConversationRead = (payload) => {
    if (!payload || Number(payload.userId) === Number(user?.id)) return;
    if (selectedConversation && String(payload.conversationId) !== String(selectedConversation.id)) return;
    setOthersRead((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((row) => Number(row.userId) === Number(payload.userId));
      const next = { userId: payload.userId, lastReadAt: payload.readAt };
      if (idx >= 0) list[idx] = next;
      else list.push(next);
      return list;
    });
  };

  const handleMessageDelivered = (payload) => {
    if (!payload?.messageId) return;
    if (selectedConversation && String(payload.conversationId) !== String(selectedConversation.id)) return;
    setMessages((prev) => prev.map((m) => (
      m.id === payload.messageId ? { ...m, deliveredAt: payload.deliveredAt || m.deliveredAt } : m
    )));
  };

  const handleReactionUpdated = (payload) => {
    if (!payload?.messageId) return;
    if (selectedConversation && String(payload.conversationId) !== String(selectedConversation.id)) return;
    setMessages((prev) => prev.map((m) => (
      m.id === payload.messageId ? { ...m, reactions: payload.reactions || [] } : m
    )));
  };

  const handleConversationUpdated = (payload) => {
    if (!payload?.id) return;
    if (payload.removedUserId != null && Number(payload.removedUserId) === Number(user?.id)) {
      setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(payload.id)));
      setSelectedConversation((current) => (Number(current?.id) === Number(payload.id) ? null : current));
      return;
    }
    setConversations((prev) => prev.map((c) => (Number(c.id) === Number(payload.id) ? { ...c, ...payload } : c)));
    setSelectedConversation((current) => (
      current && Number(current.id) === Number(payload.id) ? { ...current, ...payload } : current
    ));
  };

  const handleTyping = () => {
    if (socket && selectedConversation) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 1500) {
        lastTypingEmitRef.current = now;
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          userName: `${user.firstName} ${user.lastName}`,
        });
      }

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', {
          conversationId: selectedConversation.id,
          userId: user.id,
        });
      }, 2000);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (editingMessage) {
      await saveEditedMessage();
      return;
    }
    if (sending) return; // Parandalon dërgimin e dyfishtë
    if ((!messageContent.trim() && !file) || !selectedConversation) return;

    setSending(true);
    try {
      const formData = new FormData();
      if (messageContent.trim()) {
        formData.append('content', messageContent);
      }
      if (file) {
        formData.append('file', file);
      }
      if (replyTo) {
        formData.append('replyToId', replyTo.id);
      }

      const response = await api.post(
        `/messaging/conversations/${selectedConversation.id}/messages`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );



      setMessages(prev => {
        if (prev.some(m => m.id === response.data.id)) return prev;
        return [...prev, response.data];
      });
      placeConversationFirst(response.data, 0);
      setActionError('');
      requestAnimationFrame(() => scrollToBottom(false));
      setMessageContent('');
      setFile(null);
      setReplyTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Stop typing indicator
      if (socket) {
        socket.emit('stopTyping', {
          conversationId: selectedConversation.id,
          userId: user.id,
        });
      }
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Mesazhi nuk u dërgua. Provo përsëri.');
    } finally {
      setSending(false);
    }
  };

  const saveEditedMessage = async () => {
    if (!editingMessage || !editingMessage.content?.trim() || sending) return;
    setSending(true);
    try {
      const mid = editingMessage.id;
      const { data } = await api.put(`/messaging/messages/${mid}`, {
        content: editingMessage.content.trim(),
      });
      setMessages(prev =>
        prev.map(m => (m.id === mid ? { ...m, ...data, edited: true } : m))
      );
      setEditingMessage(null);
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Ndryshimi nuk u ruajt');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/messaging/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Mesazhi nuk u fshi');
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    try {
      const { data } = await api.post(`/messaging/messages/${messageId}/reactions`, { emoji });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions || [] } : m)));
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Reagimi nuk u ruajt');
    }
  };

  const scrollToOriginal = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      setActionError('Mesazhi origjinal nuk është në këtë faqe. Ngarko mesazhe më të vjetra.');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1600);
  };

  const submitReport = async (reason) => {
    if (!reportTarget?.id) return;
    try {
      await api.post('/moderation/reports', { targetType: 'message', targetId: reportTarget.id, reason });
      setReportTarget(null);
      setActionError('');
      window.alert('Raportimi u dërgua.');
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Raportimi nuk u dërgua');
    }
  };

  const blockPeer = async (peerId) => {
    if (!peerId || !window.confirm('Blloko këtë përdorues? Nuk do të mund të shkruani ose telefononi.')) return;
    try {
      await api.post(`/moderation/blocks/${peerId}`);
      setActionError('');
      window.alert('Përdoruesi u bllokua.');
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Bllokimi dështoi');
    }
  };

  const applyGroupPayload = (data) => {
    if (!data?.id) return;
    setSelectedConversation((current) => (current ? { ...current, ...data } : data));
    setConversations((prev) => prev.map((c) => (Number(c.id) === Number(data.id) ? { ...c, ...data } : c)));
  };

  const renameSelectedGroup = async () => {
    const name = groupRename.trim();
    if (!selectedConversation?.id || !name) return;
    try {
      const { data } = await api.put(`/messaging/conversations/${selectedConversation.id}`, { name });
      applyGroupPayload(data);
      setGroupRename('');
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Emri nuk u ndryshua');
    }
  };

  const changeGroupAvatar = async (file) => {
    if (!file || !selectedConversation?.id) return;
    const form = new FormData();
    form.append('avatar', file);
    try {
      const { data } = await api.post(`/messaging/conversations/${selectedConversation.id}/avatar`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      applyGroupPayload(data);
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Fotoja e grupit nuk u ndryshua');
    }
  };

  const removeGroupMember = async (memberId) => {
    if (!selectedConversation?.id || !window.confirm('Hiq këtë anëtar nga grupi?')) return;
    try {
      const { data } = await api.delete(`/messaging/conversations/${selectedConversation.id}/members/${memberId}`);
      applyGroupPayload(data);
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Anëtari nuk u hoq');
    }
  };

  const setMemberRole = async (memberId, role) => {
    try {
      const { data } = await api.put(`/messaging/conversations/${selectedConversation.id}/members/${memberId}/role`, { role });
      applyGroupPayload(data);
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Roli nuk u ndryshua');
    }
  };

  const transferOwnership = async (memberId) => {
    if (!window.confirm('Transfero pronësinë e grupit te ky anëtar?')) return;
    try {
      const { data } = await api.post(`/messaging/conversations/${selectedConversation.id}/transfer`, { userId: memberId });
      applyGroupPayload(data);
    } catch (err) {
      setActionError(err?.response?.data?.msg || 'Pronësia nuk u transferua');
    }
  };

  const copyText = (text) => {
    const t = (text || '').trim();
    if (!t) return;
    navigator.clipboard.writeText(t).catch(() => {});
  };

  const renderMessageContent = (message, isMine) => {
    if (message.deleted) {
      return <span className="italic text-gray-400">Message deleted</span>;
    }
    const fileLinkClass = isMine
      ? 'flex items-center gap-2 text-slate-900 hover:underline mb-2'
      : 'flex items-center gap-2 text-[var(--xt-color-gold-bright)] hover:underline mb-2';
    return (
      <>
        {message.replyTo && (
          <button
            type="button"
            className="mb-1 flex w-full items-center gap-2 border-l-2 border-[var(--xt-color-gold-deep)] pl-2 text-left text-sm text-[var(--xt-color-text-subtle)]"
            onClick={() => scrollToOriginal(message.replyTo.id)}
          >
            {replyUnavailable(message.replyTo) ? (
              <p className="italic">Mesazhi origjinal nuk është i disponueshëm</p>
            ) : (
              <>
                <p className="font-medium">
                  {message.replyTo.sender?.firstName || 'Unknown'}
                </p>
                <p className="truncate">
                  {message.replyTo.content || message.replyTo.fileName || (message.replyTo.type === 'image' ? 'Foto' : 'Media')}
                </p>
              </>
            )}
          </button>
        )}
        {message.forwarded && !message.deleted ? (
          <p className="mb-1 text-[11px] italic opacity-80">E përcjellë</p>
        ) : null}
        {message.fileUrl && message.type === 'image' && (
          <ChatMedia
            src={getFullUrl(message.fileUrl)}
            kind="image"
            alt={message.fileName || 'Shared'}
            onOpen={setModalImage}
          />
        )}
        {message.fileUrl && message.type === 'video' && (
          <ChatMedia
            src={getFullUrl(message.fileUrl)}
            kind="video"
            onOpen={setModalImage}
          />
        )}
        {message.type === 'file' && message.fileUrl && (
          <a
            href={getFullUrl(message.fileUrl)}
            download={message.fileName}
            className={fileLinkClass}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {message.fileName}
          </a>
        )}
        {message.content && (
          <p className={`whitespace-pre-wrap break-words ${isMine ? 'text-slate-950' : ''}`}>
            <Linkify
              text={message.content}
              className={isMine ? 'text-slate-950' : ''}
              linkClassName={isMine ? 'underline break-all text-slate-900 hover:text-black' : 'underline break-all opacity-95 hover:opacity-100'}
            />
          </p>
        )}
        {message.edited && (
          <span className={`ml-2 text-xs ${isMine ? 'text-slate-700' : 'text-[var(--xt-color-text-subtle)]'}`}>(edited)</span>
        )}
        <ForwardButton message={message} />
      </>
    );
  };
  const typingNames = Object.values(typingUsers).filter(Boolean);
  const typingDisplay =
    typingNames.length === 0
      ? ''
      : typingNames.length === 1
        ? `${typingNames[0]} po shkruan…`
        : `${typingNames.join(', ')} po shkruajnë…`;

  // --- WebRTC/Call logic ---
  function startCall(isVideo) {
    setCallType(isVideo ? 'video' : 'audio');
    setShowCall(true);
  }

  const directContacts = useMemo(() => {
    const map = new Map();
    conversations.forEach((conv) => {
      if (conv?.isGroup || !Array.isArray(conv?.members)) return;
      const other = conv.members.find((m) => Number(m?.id) !== Number(user?.id));
      if (other?.id && !map.has(other.id)) {
        map.set(other.id, {
          id: other.id,
          name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Unknown',
          profilePhoto: other.profilePhoto || other.Profile?.profilePhoto || '',
        });
      }
    });
    return Array.from(map.values());
  }, [conversations, user?.id]);

  const inviteableContacts = useMemo(() => {
    const existing = new Set(
      (Array.isArray(selectedConversation?.members) ? selectedConversation.members : []).map((m) =>
        Number(m.id)
      )
    );
    return directContacts.filter((c) => !existing.has(Number(c.id)));
  }, [directContacts, selectedConversation]);

  async function createGroupConversation() {
    if (!groupName.trim()) {
      alert('Shkruaj emrin e grupit.');
      return;
    }
    if (groupMembers.length < 2) {
      alert('Zgjidh të paktën 2 anëtarë.');
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await api.post('/messaging/conversations/group', {
        name: groupName.trim(),
        memberIds: groupMembers,
      });
      const created = res?.data;
      if (!created?.id) throw new Error('Group was not created');
      setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setSelectedConversation(created);
      setShowCreateGroup(false);
      setGroupName('');
      setGroupMembers([]);
    } catch (err) {
      console.error('Create group failed:', err);
      alert('Nuk u krijua grupi. Provo përsëri.');
    } finally {
      setCreatingGroup(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] min-h-[420px] max-w-[1600px] overflow-hidden border-y border-[var(--xt-color-border)] bg-[var(--xt-color-canvas)] text-[var(--xt-color-text)] relative">
      {modalImage && <MediaModal src={modalImage} alt="Shared" onClose={() => setModalImage(null)} />}
      {showCall && selectedConversation && (
        selectedConversation.isGroup ? (
          <GroupLiveKitCall
            conversationId={selectedConversation.id}
            title={selectedConversation.name || 'Grup'}
            audioOnly={callType === 'audio'}
            onClose={() => setShowCall(false)}
          />
        ) : (
          <VideoCallSimple
            targetUser={{
              id: getOtherMember(selectedConversation).id || getOtherMember(selectedConversation)._id,
              firstName: getOtherMember(selectedConversation).name?.split(' ')[0] || '',
              lastName: getOtherMember(selectedConversation).name?.split(' ')[1] || '',
              profilePhoto: getOtherMember(selectedConversation).profilePhoto
            }}
            audioOnly={callType === 'audio'}
            onClose={() => setShowCall(false)}
          />
        )
      )}
      {/* Conversations List */}
      <div className={`w-full shrink-0 border-r border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] flex-col min-h-0 md:flex md:w-80 ${selectedConversation ? 'hidden' : 'flex'}`}>
        <div className="p-4 border-b dark:border-gray-700 flex-shrink-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold dark:text-white">Mesazhet</h2>
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="btn btn-primary min-h-10 gap-1 px-3 text-xs"
            >
              <FiUsers className="w-4 h-4" />
              New Group
            </button>
          </div>
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="search"
              value={conversationSearch}
              onChange={e => setConversationSearch(e.target.value)}
              placeholder="Kërko bisedë…"
              className="input pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[var(--xt-color-text-subtle)] mb-2">Ende nuk ke biseda</p>
            <p className="text-sm text-[var(--xt-color-text-subtle)]">Fillo nga profili i një përdoruesi</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--xt-color-text-subtle)]">Nuk u gjet asnjë bisedë për këtë kërkim.</div>
        ) : (
          filteredConversations.map(conv => {
            const other = getOtherMember(conv);
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv);
                  if (conv?.isGroup && conv?.id) {
                    api
                      .get(`/messaging/conversations/detail/${conv.id}`)
                      .then((res) => {
                        if (res?.data?.id) setSelectedConversation(res.data);
                      })
                      .catch(() => {});
                  }
                }}
                className={`p-4 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-[var(--xt-color-gold)]/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    {other.profilePhoto ? (
                      <img
                        src={getFullUrl(other.profilePhoto)}
                        alt={other.name}
                        className={`w-12 h-12 rounded-full object-cover border-4 transition-all duration-300 ${onlineStatus[other.id] === true ? 'border-green-500' : 'border-gray-400'}`}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--xt-color-gold)] text-slate-950 flex items-center justify-center font-bold text-lg">
                        {(other.name && typeof other.name === 'string' && other.name.length > 0) ? other.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    {/* Online/offline dot */}
                    <span
                      title={onlineStatus[other.id] === true ? 'Online' : 'Offline'}
                      className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${onlineStatus[other.id] === true ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate dark:text-white">{other.name}</h3>
                    <p className="text-sm text-[var(--xt-color-text-subtle)] truncate">
                      {conv.isGroup && other.memberLabel
                        ? other.memberLabel
                        : conv.lastMessage || 'Start the conversation'}
                    </p>
                  </div>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-[var(--xt-color-text-subtle)] flex-shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {showCreateGroup ? (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-[var(--xt-color-surface)] rounded-xl shadow-lg p-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold dark:text-white mb-3">Krijo Group Chat</h3>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Emri i grupit"
              className="w-full mb-3 px-3 py-2 rounded-lg border dark:border-gray-600 bg-[var(--xt-color-canvas)] dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Zgjidh anëtarët:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {directContacts.map((m) => (
                <label key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setGroupMembers((prev) => [...prev, m.id]);
                      } else {
                        setGroupMembers((prev) => prev.filter((id) => id !== m.id));
                      }
                    }}
                  />
                  <span className="text-sm dark:text-gray-100">{m.name}</span>
                </label>
              ))}
              {directContacts.length === 0 ? (
                <p className="text-sm text-gray-500">Nuk ka kontakte. Fillo biseda 1-1 fillimisht.</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName('');
                  setGroupMembers([]);
                }}
                className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createGroupConversation}
                disabled={creatingGroup}
                className="px-3 py-2 rounded-lg bg-[var(--xt-color-gold)] hover:bg-[var(--xt-color-gold-bright)] text-slate-950 text-sm disabled:opacity-60"
              >
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showGroupMembersPanel && selectedConversation?.isGroup ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setShowGroupMembersPanel(false)}
          role="presentation"
        >
          <div
            className="xt-card max-h-[min(70vh,32rem)] w-full max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Anëtarët e grupit"
          >
            <div className="flex items-center justify-between border-b border-[var(--xt-color-border)] px-4 py-3">
              <h3 className="font-extrabold text-[var(--xt-color-text)]">
                Anëtarët ({Array.isArray(selectedConversation.members) ? selectedConversation.members.length : 0})
              </h3>
              <button
                type="button"
                className="btn btn-quiet min-h-10 px-3"
                onClick={() => setShowGroupMembersPanel(false)}
              >
                Mbyll
              </button>
            </div>
            {canManageGroup ? (
              <div className="flex flex-col gap-2 border-b border-[var(--xt-color-border)] px-4 py-3">
                <div className="flex gap-2">
                  <input
                    value={groupRename}
                    onChange={(e) => setGroupRename(e.target.value)}
                    placeholder="Emër i ri i grupit"
                    className="input min-h-10 flex-1 text-sm"
                  />
                  <button type="button" className="btn btn-outline min-h-10 px-3 text-sm" onClick={renameSelectedGroup}>
                    Ruaj
                  </button>
                </div>
                <label className="text-xs font-semibold text-[var(--xt-color-text-muted)]">
                  Ndrysho foton
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="mt-1 block w-full text-xs"
                    onChange={(e) => changeGroupAvatar(e.target.files?.[0])}
                  />
                </label>
              </div>
            ) : null}
            <div className="flex gap-2 border-b border-[var(--xt-color-border)] px-4 py-3">
              <button
                type="button"
                className="btn btn-outline flex-1 min-h-10 text-sm"
                disabled={inviteBusy || leaveBusy}
                onClick={() => {
                  setInviteMemberIds([]);
                  setShowInviteMembersPanel(true);
                }}
              >
                Fto anëtarë
              </button>
              <button
                type="button"
                className="btn btn-quiet flex-1 min-h-10 text-sm text-[var(--xt-color-danger)]"
                disabled={leaveBusy || inviteBusy}
                onClick={leaveSelectedGroup}
              >
                {leaveBusy ? 'Duke dalë…' : 'Dil nga grupi'}
              </button>
            </div>
            <div className="overflow-y-auto max-h-[min(55vh,26rem)]">
              {(Array.isArray(selectedConversation.members) ? selectedConversation.members : []).length === 0 ? (
                <p className="p-6 text-center text-sm text-[var(--xt-color-text-muted)]">Nuk ka anëtarë.</p>
              ) : (
                selectedConversation.members.map((m) => {
                  const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Përdorues';
                  const isMe = Number(m.id) === Number(user?.id);
                  const photo = m.profilePhoto || m.Profile?.profilePhoto || '';
                  const memberRole = m.memberRole || null;
                  const memberIsOwner = Number(selectedConversation.ownerId) === Number(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 border-b border-[var(--xt-color-border)] px-4 py-3"
                    >
                      {photo ? (
                        <img
                          src={getFullUrl(photo)}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--xt-color-gold)] text-sm font-bold text-slate-950">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/profile/${m.id}`} onClick={() => setShowGroupMembersPanel(false)} className="truncate font-semibold text-[var(--xt-color-text)]">
                          {name}
                          {isMe ? ' (ti)' : ''}
                        </Link>
                        {memberRole ? (
                          <div className="truncate text-xs text-[var(--xt-color-text-muted)]">
                            {memberIsOwner ? 'Pronar' : memberRole === 'admin' ? 'Admin' : 'Anëtar'}
                          </div>
                        ) : m.role ? (
                          <div className="truncate text-xs capitalize text-[var(--xt-color-text-muted)]">
                            {m.role}
                          </div>
                        ) : null}
                      </div>
                      {canManageGroup && !isMe && !memberIsOwner ? (
                        <div className="flex flex-col items-end gap-1 text-[11px]">
                          {memberRole === 'admin' ? (
                            <button type="button" className="hover:underline" onClick={() => setMemberRole(m.id, 'member')}>Hiq admin</button>
                          ) : (
                            <button type="button" className="hover:underline" onClick={() => setMemberRole(m.id, 'admin')}>Bëj admin</button>
                          )}
                          {(isGroupOwner || !selectedConversation.ownerId) && (
                            <button type="button" className="hover:underline" onClick={() => transferOwnership(m.id)}>Pronar</button>
                          )}
                          <button type="button" className="text-red-600 hover:underline" onClick={() => removeGroupMember(m.id)}>Hiq</button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showInviteMembersPanel && selectedConversation?.isGroup ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setShowInviteMembersPanel(false)}
          role="presentation"
        >
          <div
            className="xt-card max-h-[min(70vh,32rem)] w-full max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Fto anëtarë"
          >
            <div className="flex items-center justify-between border-b border-[var(--xt-color-border)] px-4 py-3">
              <h3 className="font-extrabold text-[var(--xt-color-text)]">Fto anëtarë</h3>
              <button
                type="button"
                className="btn btn-quiet min-h-10 px-3"
                onClick={() => setShowInviteMembersPanel(false)}
              >
                Mbyll
              </button>
            </div>
            <p className="px-4 pt-3 text-xs text-[var(--xt-color-text-muted)]">
              Zgjidh nga kontaktet e tua (biseda 1-1).
            </p>
            <div className="overflow-y-auto max-h-[min(45vh,20rem)] px-2 py-2">
              {inviteableContacts.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--xt-color-text-muted)]">
                  Nuk ka kontakte të reja. Fillo biseda 1-1 fillimisht.
                </p>
              ) : (
                inviteableContacts.map((m) => {
                  const checked = inviteMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--xt-color-surface-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInviteMemberIds((prev) => [...prev, m.id]);
                          } else {
                            setInviteMemberIds((prev) => prev.filter((id) => id !== m.id));
                          }
                        }}
                      />
                      <span className="text-sm font-semibold text-[var(--xt-color-text)]">{m.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--xt-color-border)] px-4 py-3">
              <button
                type="button"
                className="btn btn-quiet min-h-10 px-3"
                onClick={() => setShowInviteMembersPanel(false)}
              >
                Anulo
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-10 px-4"
                disabled={inviteBusy || inviteMemberIds.length === 0}
                onClick={inviteMembersToGroup}
              >
                {inviteBusy ? 'Duke shtuar…' : `Shto (${inviteMemberIds.length})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Messages Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-[var(--xt-color-canvas)] relative min-h-0">
          {/* Header */}
          <div className="p-3 border-b border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] space-y-2 flex-shrink-0">
            <div className="flex items-center gap-3 justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {(() => {
                  const other = getOtherMember(selectedConversation);
                  return (
                    <>
                      <button type="button" onClick={() => setSelectedConversation(null)} className="btn btn-quiet min-h-10 px-3 md:hidden" aria-label="Kthehu te bisedat">‹</button>
                      <div className="relative flex-shrink-0">
                        {other.profilePhoto ? (
                          <img
                            src={getFullUrl(other.profilePhoto)}
                            alt={other.name}
                            className={`w-10 h-10 rounded-full object-cover border-2 transition-all duration-300 ${onlineStatus[other.id] === true ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[var(--xt-color-gold)] text-slate-950 flex items-center justify-center font-bold text-sm">
                            {(other.name && typeof other.name === 'string' && other.name.length > 0) ? other.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <span
                          title={onlineStatus[other.id] === true ? 'Online' : 'Offline'}
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${onlineStatus[other.id] === true ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-[var(--xt-color-text)]">{other.id ? <Link to={`/profile/${other.id}`} className="hover:text-[var(--xt-color-gold-bright)]">{other.name}</Link> : other.name}</h3>
                        {selectedConversation.isGroup && other.memberLabel ? (
                          <button
                            type="button"
                            onClick={() => setShowGroupMembersPanel(true)}
                            className="block max-w-full truncate text-left text-xs text-[var(--xt-color-text-muted)] hover:text-[var(--xt-color-gold-bright)]"
                          >
                            {other.memberLabel}
                          </button>
                        ) : null}
                        {!selectedConversation.isGroup && other.club ? (
                          <p className="truncate text-xs text-[var(--xt-color-text-subtle)]">{other.club}</p>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!selectedConversation.isGroup && getOtherMember(selectedConversation).id ? (
                  <button
                    type="button"
                    title="Blloko"
                    className="p-2 rounded-full hover:bg-red-100 text-xs font-semibold text-red-600"
                    onClick={() => blockPeer(getOtherMember(selectedConversation).id)}
                  >
                    Blloko
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Thirrje zanore"
                  className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                  onClick={() => startCall(false)}
                >
                  <FiPhone className="w-5 h-5 text-[var(--xt-color-gold-bright)]" />
                </button>
                <button
                  type="button"
                  title="Video thirrje"
                  className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                  onClick={() => startCall(true)}
                >
                  <FiVideo className="w-5 h-5 text-[var(--xt-color-gold-bright)]" />
                </button>
              </div>
            </div>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="search"
                value={threadSearch}
                onChange={e => setThreadSearch(e.target.value)}
                placeholder="Kërko në këtë bisedë…"
                className="input pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          {/* Messages List */}
          <div
            ref={messagesListRef}
            onScroll={e => {
              const t = e.currentTarget;
              const dist = t.scrollHeight - t.scrollTop - t.clientHeight;
              setShowScrollDown(dist > 280);
              if (
                t.scrollTop < 72
                && !threadSearch.trim()
                && !loadingOlderRef.current
                && messagePagination.page < messagePagination.pages
              ) {
                loadOlderMessages();
              }
            }}
            className="flex-1 overflow-y-auto px-4 pb-36 min-h-0 relative"
          >
            {messagePagination.pages > 1 && messagePagination.page < messagePagination.pages && (
              <div className="flex justify-center py-3 sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  className="text-sm font-medium text-[var(--xt-color-gold-bright)] hover:underline disabled:opacity-50 px-3 py-1 rounded-full bg-[var(--xt-color-surface)] shadow border dark:border-gray-700"
                >
                  {loadingOlder ? 'Duke ngarkuar…' : 'Mesazhe më të vjetra'}
                </button>
              </div>
            )}
            {displayedMessages.map((message, idx) => {
              const prev = displayedMessages[idx - 1];
              const showDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
              const isMine = message.sender && user && message.sender.id === user.id;
              return (
                <Fragment key={message.id || `m-${idx}`}>
                  {showDay && (
                    <div className="flex justify-center my-5">
                      <span className="text-xs font-medium text-[var(--xt-color-text-subtle)] bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full shadow-sm border dark:border-gray-700">
                        {dayDividerLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`mb-3 flex gap-2 items-end ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine && (
                      <div className="flex-shrink-0">
                        {message.sender?.profilePhoto ? (
                          <img
                            src={getFullUrl(message.sender.profilePhoto)}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold">
                            {`${message.sender?.firstName?.charAt(0) || ''}${message.sender?.lastName?.charAt(0) || ''}`.trim() || '?'}
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      id={`msg-${message.id}`}
                      className={`max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 shadow-md ${
                        highlightId === message.id ? 'ring-2 ring-amber-400' : ''
                      } ${
                        isMine
                          ? 'bg-[var(--xt-color-gold)] text-slate-950 rounded-br-md'
                          : 'bg-[var(--xt-color-surface-raised)] text-[var(--xt-color-text)] border border-[var(--xt-color-border)] rounded-bl-md'
                      }`}
                    >
                      {!isMine && selectedConversation.isGroup && message.sender && (
                        <p className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300 inline-flex items-center gap-1">
                          {message.sender.firstName} {message.sender.lastName}
                          <VerifiedBadge verified={message.sender.verified} size="sm" />
                        </p>
                      )}
                      {renderMessageContent(message, isMine)}
                      <div
                        className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mt-2 pt-1 border-t ${
                          isMine ? 'border-white/20' : 'border-gray-100 dark:border-gray-700'
                        }`}
                      >
                        <span className={`text-[11px] tabular-nums ${isMine ? 'text-slate-700' : 'text-[var(--xt-color-text-subtle)]'}`}>
                          {formatTime(message.createdAt)}
                          {isMine ? ` · ${{
                            sending: 'duke dërguar',
                            sent: 'dërguar',
                            delivered: 'dorëzuar',
                            read: 'lexuar',
                            failed: 'dështoi',
                          }[outboundChatStatus(message, othersRead, user?.id)] || ''}` : ''}
                        </span>
                        {!message.deleted && Array.isArray(message.reactions) && message.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {message.reactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                type="button"
                                className={`rounded-full px-1.5 text-[11px] ${reaction.mine ? 'bg-black/10' : ''}`}
                                onClick={() => toggleReaction(message.id, reaction.emoji)}
                              >
                                {reaction.emoji} {reaction.count}
                              </button>
                            ))}
                          </div>
                        )}
                        {!message.deleted && (
                          <div className={`flex flex-wrap gap-2 text-[11px] ${isMine ? 'text-blue-100' : 'text-[var(--xt-color-text-subtle)]'}`}>
                            <button type="button" className="hover:underline" onClick={() => setReplyTo(message)}>
                              Përgjigju
                            </button>
                            {!!message.content?.trim() && (
                              <button type="button" className="hover:underline" onClick={() => copyText(message.content)}>
                                Kopjo
                              </button>
                            )}
                            {isMine && message.content?.trim() && !message.fileUrl && (
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => setEditingMessage({ id: message.id, content: message.content })}
                              >
                                Ndrysho
                              </button>
                            )}
                            {isMine && (
                              <button type="button" className="hover:underline" onClick={() => deleteMessage(message.id)}>
                                Fshi
                              </button>
                            )}
                            <span className="relative">
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => setReactionMenuId((openId) => (openId === message.id ? null : message.id))}
                              >
                                Reagim
                              </button>
                              {reactionMenuId === message.id ? (
                                <span className="absolute bottom-full left-0 z-30 mb-1 flex gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                                  {REACTION_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="text-base leading-none hover:scale-110"
                                      onClick={() => {
                                        setReactionMenuId(null);
                                        toggleReaction(message.id, emoji);
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            {!isMine && (
                              <button type="button" className="hover:underline" onClick={() => setReportTarget(message)}>
                                Raporto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {typingDisplay && (
              <p className="text-sm text-[var(--xt-color-text-subtle)] italic py-2">{typingDisplay}</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollDown && (
            <button
              type="button"
              aria-label="Shko poshtë"
              onClick={() => scrollToBottom(false)}
              className="absolute bottom-40 right-4 z-40 rounded-full bg-[var(--xt-color-gold)] p-3 text-slate-950 shadow-lg transition md:bottom-36"
            >
              <FiChevronDown className="w-5 h-5" />
            </button>
          )}

          {/* Input */}
          {actionError ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <span>{actionError}</span>
              <button type="button" className="font-semibold" onClick={() => setActionError('')}>Mbyll</button>
            </div>
          ) : null}
          <form
            onSubmit={sendMessage}
            className="p-4 bg-[var(--xt-color-surface)] border-t dark:border-gray-700 w-full fixed left-0 right-0 bottom-16 z-50 md:static md:bottom-auto flex-shrink-0"
          >
            {editingMessage && (
              <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl flex justify-between items-start gap-2">
                <div className="text-sm dark:text-gray-200 min-w-0">
                  <span className="font-medium text-amber-800 dark:text-amber-200">Po ndryshon mesazhin</span>
                  <p className="text-[var(--xt-color-text-muted)] truncate mt-0.5">{editingMessage.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMessage(null)}
                  className="text-[var(--xt-color-text-subtle)] hover:text-gray-800 dark:hover:text-gray-100 flex-shrink-0"
                  aria-label="Anulo ndryshimin"
                >
                  ✕
                </button>
              </div>
            )}
            {replyTo && !editingMessage && (
              <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl flex justify-between items-center gap-2">
                <div className="text-sm dark:text-gray-200 min-w-0">
                  <span className="font-medium">Përgjigje te:</span>{' '}
                  <span className="text-[var(--xt-color-text-muted)] truncate">{replyTo.content}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-[var(--xt-color-text-subtle)] hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            )}
            {file && !editingMessage && (
              <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl flex justify-between items-center">
                <span className="text-sm dark:text-gray-200 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[var(--xt-color-text-subtle)] hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            )}
            {showEmojiBar && !editingMessage && (
              <div className="mb-2 flex flex-wrap gap-1 p-2 bg-[var(--xt-color-canvas)] rounded-xl border dark:border-gray-700">
                {QUICK_EMOJIS.map(em => (
                  <button
                    key={em}
                    type="button"
                    className="text-xl p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
                    onClick={() => {
                      setMessageContent(c => `${c}${em}`);
                      textareaRef.current?.focus();
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                disabled={!!editingMessage}
                accept="image/*,video/*,.pdf,.doc,.docx,.mp3,.wav"
              />
              <button
                type="button"
                title="Bashkëngjit skedar"
                disabled={!!editingMessage}
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[var(--xt-color-text-subtle)] hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                type="button"
                title="Emoji të shpejta"
                disabled={!!editingMessage}
                onClick={() => setShowEmojiBar(v => !v)}
                className={`p-2 rounded-lg ${showEmojiBar ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-[var(--xt-color-text-subtle)]'} hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40`}
              >
                <FiSmile className="w-6 h-6" />
              </button>
              <textarea
                ref={textareaRef}
                rows={editingMessage ? 2 : 2}
                value={editingMessage ? editingMessage.content : messageContent}
                onChange={(e) => {
                  if (editingMessage) {
                    setEditingMessage({ ...editingMessage, content: e.target.value });
                  } else {
                    setMessageContent(e.target.value);
                    handleTyping();
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setReplyTo(null);
                    setEditingMessage(null);
                    setShowEmojiBar(false);
                  }
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder={editingMessage ? 'Ndrysho mesazhin…' : 'Shkruaj mesazhin… (⌘/Ctrl+Enter për dërguar)'}
                className="input min-h-[44px] max-h-32 flex-1 resize-none"
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  (editingMessage ? !editingMessage.content?.trim() : !messageContent.trim() && !file)
                }
                className="btn btn-primary min-h-11 shrink-0 px-4 disabled:cursor-not-allowed"
              >
                {sending ? '…' : editingMessage ? 'Ruaj' : 'Dërgo'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[var(--xt-color-canvas)]">
          <div className="text-center">
            <svg className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-[var(--xt-color-text-subtle)] text-lg">Zgjidh një bisedë për të vazhduar</p>
            <p className="text-sm text-[var(--xt-color-text-subtle)] mt-2 max-w-sm mx-auto">
              Nëse ke lidhur nga një link me <code className="text-xs bg-gray-200 dark:bg-gray-800 px-1 rounded">conversationId</code> ose{' '}
              <code className="text-xs bg-gray-200 dark:bg-gray-800 px-1 rounded">userId</code>, biseda duhet të hapet automatikisht pasi të ngarkohet lista.
            </p>
          </div>
        </div>
      )}
      {reportTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-bold text-slate-900">Raporto mesazhin</h3>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map(([key, label]) => (
                <button key={key} type="button" className="rounded-lg border px-3 py-2 text-left text-sm text-slate-800 hover:bg-gray-50" onClick={() => submitReport(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Messaging;
