import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { messagingAPI } from '../services/api';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function MessagingSimple() {
  const { user } = useAuth();
  const location = useLocation();
  
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch existing conversations on load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Handle navigation from Profile with conversationId
  useEffect(() => {
    if (location.state?.conversationId) {
      const convId = location.state.conversationId;
      console.log('🔵 Opening conversation from navigation:', convId);
      
      setCurrentConversation({ id: convId });
      fetchMessages(convId);
    }
  }, [location.state]);

  // Poll for messages when conversation is active
  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation.id);
      const interval = setInterval(() => fetchMessages(currentConversation.id), 3000);
      return () => clearInterval(interval);
    }
  }, [currentConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await messagingAPI.getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await messagingAPI.getConversationMessages(conversationId);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentConversation || sending) return;

    setSending(true);
    try {
      const response = await messagingAPI.sendConversationMessage(currentConversation.id, {
        content: newMessage,
      });
      setMessages([...messages, response.data]);
      setNewMessage('');
      
      // Refresh conversations list to show the new conversation
      fetchConversations();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOtherMember = (conversation) => {
    if (!conversation?.members) return null;
    const otherMember = conversation.members.find(m => m.id !== user?.id);
    return otherMember;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Conversations List Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mesazhet</h2>
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
            <ChatBubbleLeftRightIcon className="h-16 w-16 mb-4" />
            <p className="text-center text-sm">Asnjë bisedë ende</p>
            <p className="text-center text-xs mt-2">Biseda do të shfaqen këtu pasi të dërgoni mesazhin e parë</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map((conv) => {
              const otherMember = getOtherMember(conv);
              if (!otherMember) return null;
              
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setCurrentConversation(conv);
                    fetchMessages(conv.id);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    currentConversation?.id === conv.id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold text-lg">
                      {otherMember.firstName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {otherMember.firstName} {otherMember.lastName}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {conv.lastMessage}
                        </p>
                      )}
                      {conv.lastMessageAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatTime(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const otherMember = getOtherMember(currentConversation);
                  if (!otherMember) return null;
                  
                  return (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                        {otherMember.firstName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {otherMember.firstName} {otherMember.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {otherMember.role}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-lg font-semibold mb-1">Nuk ka mesazhe</p>
                  <p className="text-sm">Dërgo një mesazh për të filluar bisedën</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="break-words">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Shkruaj një mesazh..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <ChatBubbleLeftRightIcon className="h-24 w-24 mb-4" />
            <p className="text-xl font-semibold mb-2">Zgjidh një bisedë</p>
            <p className="text-sm">Zgjidh një bisedë nga lista ose kliko "Message" në profilin e dikujt për të filluar</p>
          </div>
        )}
      </div>
    </div>
  );
}
