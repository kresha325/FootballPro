import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { FiPhone, FiVideo } from 'react-icons/fi';
import VideoCallSimple from './VideoCallSimple';
import ForwardButton from './ForwardButton';

import { API_URL } from '../config/api';

// Modal për shfaqjen e fotove të mëdha
function ImageModal({ src, alt, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={onClose}>
      <div className="relative" onClick={e => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] rounded shadow-lg border-4 border-white"
        />
        <a
          href={src}
          download
          className="absolute top-2 right-2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 px-4 py-2 rounded shadow border border-gray-300 text-sm font-semibold transition"
          onClick={e => e.stopPropagation()}
        >
          Save photo
        </a>
      </div>
    </div>
  );
}

function Messaging() {
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    return API_URL + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  // Ngarko bisedat sapo hapet komponenti
  useEffect(() => {
    fetchConversations();
  }, []);
  const [modalImage, setModalImage] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({}); // { [userId]: true/false }
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
                const res = await axios.get(`${API_URL}/users/${other.id}/online`);
                statusObj[other.id] = res.data.online;
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
  const { user } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  // Lexo userId dhe conversationId nga query me URLSearchParams
  const query = new URLSearchParams(location.search);
  const userId = query.get('userId');
  const conversationId = query.get('conversationId');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  // Video/audio call state
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' or 'audio'

  // Auto-open conversation if userId or conversationId is in query
  useEffect(() => {
    if (conversationId && conversations.length > 0 && !selectedConversation) {
      // Hap bisedën sipas conversationId
      const conv = conversations.find(c => c.id === conversationId || c.id === parseInt(conversationId));
      if (conv) {
        setSelectedConversation(conv);
      } else {
        // Merr bisedën nga backend nëse nuk është në listë
        api.get(`/messaging/conversations/${conversationId}`)
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
  }, [location.state, conversations]);

  useEffect(() => {
    if (socket) {
      socket.on('newMessage', handleNewMessage);
      socket.on('userTyping', handleUserTyping);
      socket.on('userStoppedTyping', handleUserStoppedTyping);

      return () => {
        socket.off('newMessage', handleNewMessage);
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const fetchMessages = async (conversationId) => {
    try {
      const response = await api.get(`/messaging/conversations/${conversationId}/messages`);
      setMessages(response.data.messages);
      // Mark as read
      await api.put(`/messaging/conversations/${conversationId}/read`);
      // Update unread count in conversation list
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const handleNewMessage = (message) => {
    if (selectedConversation && message.conversationId === selectedConversation.id) {
      setMessages(prev => [...prev, message]);
      // Mark as read immediately if conversation is open
      api.put(`/messaging/conversations/${selectedConversation.id}/read`);
    } else {
      // Update unread count
      setConversations(prev =>
        prev.map(conv =>
          conv.id === message.conversationId
            ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
            : conv
        )
      );
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



      setMessages(prev => [...prev, response.data]);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getOtherMember = (conversation) => {
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
    const otherMember = conversation.members.find(m => m.id !== user.id);
    if (!otherMember) {
      return { name: 'Unknown', profilePhoto: '', id: null };
    }
    return {
      name: `${otherMember.firstName || ''} ${otherMember.lastName || ''}`.trim() || 'Unknown',
      profilePhoto: otherMember.profilePhoto || '',
      id: otherMember.id || null,
    };
  };

  const formatTime = (date) => {
    const messageDate = new Date(date);
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

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/messaging/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  const renderMessageContent = (message) => {
    if (message.deleted) {
      return <span className="italic text-gray-400">Message deleted</span>;
    }
    return (
      <>
        {message.replyTo && (
          <div className="mb-1 pl-2 border-l-2 border-blue-500 text-sm text-gray-500 flex items-center gap-2">
            {message.replyTo.sender && message.replyTo.sender.profilePhoto ? (
              <img
                src={message.replyTo.sender.profilePhoto.startsWith('http') ? message.replyTo.sender.profilePhoto : `${API_URL}${message.replyTo.sender.profilePhoto}`}
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
        {message.type === 'image' && message.fileUrl && (
          <img
            src={message.fileUrl.startsWith('/uploads/')
              ? `${API_URL}${message.fileUrl}`
              : `${API_URL}${message.fileUrl}`}
            alt={message.fileName || 'Shared'}
            className="rounded mb-2 cursor-pointer max-w-[180px] max-h-[180px] object-cover border border-gray-300"
            onClick={() => setModalImage(message.fileUrl.startsWith('/uploads/')
              ? `${API_URL}${message.fileUrl}`
              : `${API_URL}${message.fileUrl}`)}
          />
        )}
        {message.type === 'video' && message.fileUrl && (
          <video
            src={message.fileUrl.startsWith('/uploads/')
              ? `${API_URL}${message.fileUrl}`
              : `${API_URL}${message.fileUrl}`}
            controls
            className="max-w-xs rounded mb-2"
          />
        )}
        {message.type === 'file' && message.fileUrl && (
          <a
            href={message.fileUrl.startsWith('/uploads/')
              ? `${API_URL}${message.fileUrl}`
              : `${API_URL}${message.fileUrl}`}
            download={message.fileName}
            className="flex items-center gap-2 text-blue-500 hover:underline mb-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {message.fileName}
          </a>
        )}
        {message.content && <p>{message.content}</p>}
        {message.edited && <span className="text-xs text-gray-400 ml-2">(edited)</span>}
        <ForwardButton message={message} />
      </>
    );
  };
  const typingDisplay = Object.values(typingUsers).join(', ');

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
      {modalImage && <ImageModal src={modalImage} alt="Shared" onClose={() => setModalImage(null)} />}
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
      <div className="w-80 border-r bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold dark:text-white">Messages</h2>
        </div>
        {conversations.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-2">No conversations yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Start a conversation by visiting a user's profile</p>
          </div>
        ) : (
          conversations.map(conv => {
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

      {/* Messages Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 relative">
          {/* Header */}
          <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              {(() => {
                const other = getOtherMember(selectedConversation);
                return (
                  <>
                    {other.profilePhoto ? (
                      <img
                        src={getFullUrl(other.profilePhoto)}
                        alt={other.name}
                        className={`w-10 h-10 rounded-full object-cover border-4 transition-all duration-300 ${onlineStatus[other.id] === true ? 'border-green-500' : 'border-gray-400'}`}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                        {(other.name && typeof other.name === 'string' && other.name.length > 0) ? other.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    {/* Online/offline dot */}
                    <span
                      title={onlineStatus[other.id] === true ? 'Online' : 'Offline'}
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${onlineStatus[other.id] === true ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                    <h3 className="font-semibold dark:text-white">{other.name}</h3>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button
                title="Audio Call"
                className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                onClick={() => startCall(false)}
              >
                <FiPhone className="w-6 h-6 text-blue-500" />
              </button>
              <button
                title="Video Call"
                className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                onClick={() => startCall(true)}
              >
                <FiVideo className="w-6 h-6 text-blue-500" />
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto px-4 pb-32">
            {messages.map((message, idx) => {
              const isMine = message.sender && user && message.sender.id === user.id;
              return (
                <div
                  key={message.id || idx}
                  className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isMine
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border dark:border-gray-700'
                    }`}
                  >
                    {/* Show sender name for group messages if not mine */}
                    {!isMine && selectedConversation.isGroup && message && message.sender && (
                      <p className="text-xs font-semibold mb-1">
                        {message.sender.firstName} {message.sender.lastName}
                      </p>
                    )}
                    {renderMessageContent(message)}
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formatTime(message.createdAt)}
                      </span>
                      {isMine && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setReplyTo(message)}
                            className={`text-xs hover:underline ${isMine ? 'text-blue-100' : ''}`}
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className={`text-xs hover:underline ${isMine ? 'text-blue-100' : ''}`}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingDisplay && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">{typingDisplay} is typing...</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 w-full fixed left-0 right-0 bottom-16 z-50 md:static md:bottom-auto"
          >
            {replyTo && (
              <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded flex justify-between items-center">
                <div className="text-sm dark:text-gray-200">
                  <span className="font-medium">Replying to:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{replyTo.content}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            )}
            {file && (
              <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded flex justify-between items-center">
                <span className="text-sm dark:text-gray-200">{file.name}</span>
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
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.mp3,.wav"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                rows={1}
                value={messageContent}
                onChange={(e) => {
                  setMessageContent(e.target.value);
                  handleTyping();
                }}
                placeholder="Type a message..."
                className="flex-1 border dark:border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white resize-none"
              />
              <button
                type="submit"
                disabled={sending || (!messageContent.trim() && !file)}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Sending...' : 'Send'}
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
            <p className="text-gray-500 dark:text-gray-400 text-lg">Select a conversation to start messaging</p>
            <p className="text-red-500 font-bold mt-2">(Debug) Nuk ka bisedë të hapur! Kontrollo nëse conversationId ose userId është në URL dhe nëse API kthen bisedën.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messaging;