import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { FiPhone, FiVideo, FiSearch, FiSmile, FiChevronDown } from 'react-icons/fi';
import VideoCallSimple from './VideoCallSimple';
import ForwardButton from './ForwardButton';

import { API_URL, BACKEND_URL } from '../config/api';

const QUICK_EMOJIS = ['⚽', '🔥', '😀', '😂', '👍', '❤️', '🎉', '👏', '🙌', '😮'];

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
  const [conversationSearch, setConversationSearch] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [messagePagination, setMessagePagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const loadingOlderRef = useRef(false);

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
      return { name: 'Unknown', profilePhoto: '', id: null };
    }
    if (conversation.isGroup) {
      return {
        name: conversation.name || 'Group Chat',
        profilePhoto: conversation.avatar,
        id: null,
      };
    }
    if (!conversation.members || !Array.isArray(conversation.members)) {
      return { name: 'Unknown', profilePhoto: '', id: null };
    }
    const otherMember = conversation.members.find(m => m.id !== user?.id);
    if (!otherMember) {
      return { name: 'Unknown', profilePhoto: '', id: null };
    }
    return {
      name: `${otherMember.firstName || ''} ${otherMember.lastName || ''}`.trim() || 'Unknown',
      profilePhoto:
        otherMember.profilePhoto ||
        otherMember.Profile?.profilePhoto ||
        '',
      id: otherMember.id || null,
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
    const q = threadSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m => {
      if (m.deleted) return false;
      const c = (m.content || '').toLowerCase();
      const f = (m.fileName || '').toLowerCase();
      return c.includes(q) || f.includes(q);
    });
  }, [messages, threadSearch]);

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
          const other = conv.members.find(m => m.id !== user.id);
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
    if (socket) {
      socket.on('newMessage', handleNewMessage);
      socket.on('messageUpdated', handleMessageUpdated);
      socket.on('messageDeleted', handleMessageDeleted);
      socket.on('userTyping', handleUserTyping);
      socket.on('userStoppedTyping', handleUserStoppedTyping);

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.off('messageUpdated', handleMessageUpdated);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('userTyping', handleUserTyping);
        socket.off('userStoppedTyping', handleUserStoppedTyping);
      };
    }
  }, [socket, selectedConversation]);

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
      const { messages: rows, page, pages, total } = response.data;
      setMessages(rows || []);
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
      setTimeout(() => {
        if (messagesListRef.current) {
          const newH = messagesListRef.current.scrollHeight;
          messagesListRef.current.scrollTop = newH - prevScrollHeight;
        }
        loadingOlderRef.current = false;
      }, 0);
    } catch (err) {
      console.error('Load older messages error:', err);
      loadingOlderRef.current = false;
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleNewMessage = (message) => {
    if (
      selectedConversation &&
      message &&
      String(message.conversationId) === String(selectedConversation.id)
    ) {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      api.put(`/messaging/conversations/${selectedConversation.id}/read`);
      if (!loadingOlderRef.current) {
        requestAnimationFrame(() => scrollToBottom(false));
      }
    } else if (message?.conversationId != null) {
      // Update unread count
      const cid = String(message.conversationId);
      setConversations(prev =>
        prev.map(conv =>
          String(conv.id) === cid
            ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
            : conv
        )
      );
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

  const handleUserTyping = ({ userId, userName }) => {
    setTypingUsers(prev => ({ ...prev, [userId]: userName }));
  };

  const handleUserStoppedTyping = ({ userId }) => {
    setTypingUsers(prev => {
      const newTyping = { ...prev };
      delete newTyping[userId];
      return newTyping;
    });
  };

  const handleTyping = () => {
    if (socket && selectedConversation) {
      socket.emit('typing', {
        conversationId: selectedConversation.id,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
      });

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
      if (socket) {
        try {
          socket.emit('sendMessage', { conversationId: selectedConversation.id, message: response.data });
        } catch (e) {
          console.warn('[Messaging] socket emit sendMessage failed', e.message || e);
        }
      }
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
      console.error('Send message error:', err);
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
      console.error('Edit message error:', err);
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
      console.error('Delete message error:', err);
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
      ? 'flex items-center gap-2 text-blue-100 hover:underline mb-2'
      : 'flex items-center gap-2 text-blue-500 hover:underline mb-2';
    return (
      <>
        {message.replyTo && (
          <div className="mb-1 pl-2 border-l-2 border-blue-500 text-sm text-gray-500 flex items-center gap-2">
            {message.replyTo.sender && message.replyTo.sender.profilePhoto ? (
              <img
                src={getFullUrl(message.replyTo.sender.profilePhoto)}
                alt={message.replyTo.sender.firstName}
                className="w-6 h-6 rounded-full object-cover"
                onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                {`${message.replyTo.sender?.firstName?.charAt(0)?.toUpperCase() || ''}${message.replyTo.sender?.lastName?.charAt(0)?.toUpperCase() || ''}`}
              </div>
            )}
            <p className="font-medium">
              {message.replyTo.sender && message.replyTo.sender.firstName
                ? message.replyTo.sender.firstName
                : 'Unknown'}
            </p>
            <p className="truncate">{message.replyTo.content}</p>
          </div>
        )}
        {message.fileUrl && message.type === 'image' && (
          <img
            src={getFullUrl(message.fileUrl)}
            alt={message.fileName || 'Shared'}
            className="rounded mb-2 cursor-pointer max-w-[180px] max-h-[180px] object-cover border border-gray-300"
            onClick={() => setModalImage(getFullUrl(message.fileUrl))}
          />
        )}
        {message.fileUrl && message.type === 'video' && (
          <video
            src={getFullUrl(message.fileUrl)}
            controls
            className="max-w-xs rounded mb-2 cursor-pointer"
            onClick={() => setModalImage(getFullUrl(message.fileUrl))}
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
          <p className={`whitespace-pre-wrap break-words ${isMine ? 'text-white' : ''}`}>
            <Linkify
              text={message.content}
              className={isMine ? 'text-white' : ''}
              linkClassName={isMine ? 'underline break-all text-blue-100 hover:text-white' : 'underline break-all opacity-95 hover:opacity-100'}
            />
          </p>
        )}
        {message.edited && (
          <span className={`text-xs ml-2 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>(edited)</span>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  return (
    <div className="flex h-[calc(100vh-64px)] relative">
      {modalImage && <MediaModal src={modalImage} alt="Shared" onClose={() => setModalImage(null)} />}
      {showCall && selectedConversation && (
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
      )}
      {/* Conversations List */}
      <div className="w-80 border-r bg-white dark:bg-gray-800 flex flex-col min-h-0">
        <div className="p-4 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold dark:text-white mb-3">Mesazhet</h2>
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="search"
              value={conversationSearch}
              onChange={e => setConversationSearch(e.target.value)}
              placeholder="Kërko bisedë…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-2">Ende nuk ke biseda</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Fillo nga profili i një përdoruesi</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">Nuk u gjet asnjë bisedë për këtë kërkim.</div>
        ) : (
          filteredConversations.map(conv => {
            const other = getOtherMember(conv);
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                      <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {conv.lastMessage || 'Start the conversation'}
                    </p>
                  </div>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
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

      {/* Messages Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 relative min-h-0">
          {/* Header */}
          <div className="p-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-3 justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {(() => {
                  const other = getOtherMember(selectedConversation);
                  return (
                    <>
                      <div className="relative flex-shrink-0">
                        {other.profilePhoto ? (
                          <img
                            src={getFullUrl(other.profilePhoto)}
                            alt={other.name}
                            className={`w-10 h-10 rounded-full object-cover border-2 transition-all duration-300 ${onlineStatus[other.id] === true ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                            {(other.name && typeof other.name === 'string' && other.name.length > 0) ? other.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <span
                          title={onlineStatus[other.id] === true ? 'Online' : 'Offline'}
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${onlineStatus[other.id] === true ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                      </div>
                      <h3 className="font-semibold dark:text-white truncate">{other.name}</h3>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  title="Thirrje zanore"
                  className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                  onClick={() => startCall(false)}
                >
                  <FiPhone className="w-5 h-5 text-blue-500" />
                </button>
                <button
                  type="button"
                  title="Video thirrje"
                  className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                  onClick={() => startCall(true)}
                >
                  <FiVideo className="w-5 h-5 text-blue-500" />
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
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            }}
            className="flex-1 overflow-y-auto px-4 pb-36 min-h-0 relative"
          >
            {messagePagination.pages > 1 && messagePagination.page < messagePagination.pages && (
              <div className="flex justify-center py-3 sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 px-3 py-1 rounded-full bg-white dark:bg-gray-800 shadow border dark:border-gray-700"
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
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full shadow-sm border dark:border-gray-700">
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
                      className={`max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 shadow-md ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border dark:border-gray-700 rounded-bl-md'
                      }`}
                    >
                      {!isMine && selectedConversation.isGroup && message.sender && (
                        <p className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                          {message.sender.firstName} {message.sender.lastName}
                        </p>
                      )}
                      {renderMessageContent(message, isMine)}
                      <div
                        className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mt-2 pt-1 border-t ${
                          isMine ? 'border-white/20' : 'border-gray-100 dark:border-gray-700'
                        }`}
                      >
                        <span className={`text-[11px] tabular-nums ${isMine ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {formatTime(message.createdAt)}
                        </span>
                        {!message.deleted && (
                          <div className={`flex flex-wrap gap-2 text-[11px] ${isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
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
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {typingDisplay && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">{typingDisplay}</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollDown && (
            <button
              type="button"
              aria-label="Shko poshtë"
              onClick={() => scrollToBottom(false)}
              className="absolute bottom-40 right-4 z-40 rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 transition md:bottom-36"
            >
              <FiChevronDown className="w-5 h-5" />
            </button>
          )}

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 w-full fixed left-0 right-0 bottom-16 z-50 md:static md:bottom-auto flex-shrink-0"
          >
            {editingMessage && (
              <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl flex justify-between items-start gap-2">
                <div className="text-sm dark:text-gray-200 min-w-0">
                  <span className="font-medium text-amber-800 dark:text-amber-200">Po ndryshon mesazhin</span>
                  <p className="text-gray-600 dark:text-gray-400 truncate mt-0.5">{editingMessage.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMessage(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 flex-shrink-0"
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
                  <span className="text-gray-600 dark:text-gray-400 truncate">{replyTo.content}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
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
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            )}
            {showEmojiBar && !editingMessage && (
              <div className="mb-2 flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
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
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40"
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
                className={`p-2 rounded-lg ${showEmojiBar ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40`}
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
                className="flex-1 border dark:border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white resize-none min-h-[44px] max-h-32"
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  (editingMessage ? !editingMessage.content?.trim() : !messageContent.trim() && !file)
                }
                className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {sending ? '…' : editingMessage ? 'Ruaj' : 'Dërgo'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <svg className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Zgjidh një bisedë për të vazhduar</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-sm mx-auto">
              Nëse ke lidhur nga një link me <code className="text-xs bg-gray-200 dark:bg-gray-800 px-1 rounded">conversationId</code> ose{' '}
              <code className="text-xs bg-gray-200 dark:bg-gray-800 px-1 rounded">userId</code>, biseda duhet të hapet automatikisht pasi të ngarkohet lista.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messaging;