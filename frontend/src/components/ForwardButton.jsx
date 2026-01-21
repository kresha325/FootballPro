import { useState } from 'react';
import api from '../services/api';

function ForwardButton({ message }) {
  const [showList, setShowList] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forwardingId, setForwardingId] = useState(null); // id e bisedës që po dërgohet
  const apiRoot = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };

  // Helper to get avatar and name for conversation
  const getOtherMember = (conv) => {
    if (conv.isGroup) {
      return {
        name: conv.name || 'Group Chat',
        profilePhoto: conv.avatar,
        subtitle: 'Group',
      };
    }
    const other = conv.members?.find(m => m.id !== message.sender?.id);
    return {
      name: other ? `${other.firstName} ${other.lastName}` : 'Unknown',
      profilePhoto: other?.profilePhoto,
      subtitle: 'Direct Message',
    };
  };

  // Merr bisedat kur hapet lista
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messaging/conversations');
      setConversations(res.data);
    } catch (err) {
      setConversations([]);
    }
    setLoading(false);
      if (message.type === 'image' || message.type === 'video' || message.type === 'file') {
        // Shkarko file-in dhe dërgo si file të ri
        const response = await fetch(getFullUrl(message.fileUrl));
        const blob = await response.blob();
        formData.append('file', blob, message.fileName || 'media');
      }
        const response = await fetch(getFullUrl(message.fileUrl));
        const blob = await response.blob();
        formData.append('file', blob, message.fileName || 'media');
      }
      if (message.content) {
        formData.append('content', message.content);
      }
      await api.post(`/messaging/conversations/${convId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
      setTimeout(() => setShowList(false), 1000);
    } catch (err) {
      // mund të shtosh error handling
    }
    setForwardingId(null);
  };

  return (
    <span className="ml-2 inline-block relative">
      <button
        className="text-xs text-blue-400 hover:underline"
        onClick={() => {
          setShowList((v) => !v);
          if (!conversations.length) fetchConversations();
        }}
      >
        Forward
      </button>
      {showList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md md:max-w-lg p-0 relative">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <h3 className="text-lg font-semibold">Forward message</h3>
              <button
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
                onClick={() => setShowList(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-2 py-1" style={{ maxHeight: '360px' }}>
              {loading ? (
                <div className="p-4 text-gray-500 text-center text-sm">Loading...</div>
              ) : success ? (
                <div className="p-4 text-green-600 text-center text-sm">Message forwarded!</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-gray-500 text-center text-sm">
                  No conversations found to forward.<br />
                  <span className="text-xs text-gray-400">Start a conversation first.</span>
                </div>
              ) : (
                <>
                  {/* Forwarded message preview and label */}
                  <div className="px-4 pt-2 pb-1 border-b border-gray-100 mb-1">
                    <div className="text-xs text-gray-500 mb-1">Forwarding this message:</div>
                    <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 max-w-full flex items-center gap-3">
                      {message.type === 'image' && message.fileUrl ? (
                        <>
                            <img
                              src={getFullUrl(message.fileUrl)}
                            alt="Image preview"
                            className="w-12 h-12 object-cover rounded border"
                          />
                          <span className="italic text-blue-500">Image</span>
                        </>
                      ) : message.type === 'video' && message.fileUrl ? (
                        <>
                            <video
                              src={getFullUrl(message.fileUrl)}
                            className="w-12 h-12 object-cover rounded border"
                            style={{ background: '#222' }}
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <span className="italic text-purple-500">Video</span>
                        </>
                      ) : message.type === 'file' && message.fileUrl ? (
                        <span className="italic text-green-500">[File]</span>
                      ) : message.content ? (
                        message.content.length > 80 ? message.content.slice(0, 80) + '…' : message.content
                      ) : (
                        <span className="italic text-gray-400">(No content)</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-gray-700">Forward to:</div>
                  </div>
                  <ul>
                    {conversations.slice(0, 5).map((conv, idx) => {
                      const other = getOtherMember(conv);
                      return (
                        <li
                          key={conv.id}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition rounded ${
                            forwardingId === conv.id
                              ? 'bg-blue-100 opacity-70' : 'hover:bg-blue-50'
                          }`}
                          style={{
                            borderBottom: idx !== Math.min(conversations.length, 5) - 1 ? '1px solid #f0f0f0' : 'none',
                          }}
                          onClick={() => forwardingId ? null : handleForward(conv.id)}
                        >
                            {other.profilePhoto ? (
                              <img
                                src={getFullUrl(other.profilePhoto)}
                                alt={other.name}
                                className="w-10 h-10 rounded-full object-cover border"
                              />
                            ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg">
                              {other.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold truncate text-gray-900">{other.name}</span>
                            <span className="text-xs text-gray-500">{other.subtitle}</span>
                          </div>
                          {forwardingId === conv.id && (
                            <svg className="animate-spin w-5 h-5 text-blue-500 ml-2" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

export default ForwardButton;