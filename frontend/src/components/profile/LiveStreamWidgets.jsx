import { useEffect, useState } from 'react';
import { fetchJsonSafe } from '../../utils/mediaUrl';

/** Chat Live për modalin e stream-it në profil */
export function LiveStreamChat({ streamId, userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await fetchJsonSafe(`/api/live-chat/${streamId}`);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Live chat fetch error:', err?.message || err);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    try {
      await fetchJsonSafe('/api/live-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, userId, message: input }),
      });
      setInput('');
      const data = await fetchJsonSafe(`/api/live-chat/${streamId}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Live chat send error:', err?.message || err);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 8, maxHeight: 300, overflowY: 'auto', background: '#fff' }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Chat Live</div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 'bold' }}>{msg.userId}:</span> {msg.message}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Shkruaj mesazhin..."
          style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button
          type="button"
          onClick={sendMessage}
          style={{ marginLeft: 8, padding: '6px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          Dërgo
        </button>
      </div>
    </div>
  );
}

/** Reactions/Emoji për modalin e stream-it */
export function LiveStreamReactions({ streamId, userId }) {
  const emojis = ['👍', '❤️', '😂', '🔥', '👏'];
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    const loadReactions = async () => {
      try {
        const data = await fetchJsonSafe(`/api/live-reaction/${streamId}`);
        setReactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Live reactions fetch error:', err?.message || err);
      }
    };

    loadReactions();
    const interval = setInterval(loadReactions, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const sendReaction = async (emoji) => {
    try {
      await fetchJsonSafe('/api/live-reaction/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, userId, emoji }),
      });
      const data = await fetchJsonSafe(`/api/live-reaction/${streamId}`);
      setReactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Live reaction send error:', err?.message || err);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Reactions</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendReaction(emoji)}
            style={{ fontSize: 22, padding: '4px 10px', border: 'none', background: '#f0f0f0', borderRadius: 6, cursor: 'pointer' }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 60, overflowY: 'auto', fontSize: 16 }}>
        {reactions.slice(-10).map((r, idx) => (
          <span key={idx} style={{ marginRight: 6 }}>
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Invite Guests për modalin e stream-it */
export function LiveStreamGuests({ streamId, userId }) {
  const [guests, setGuests] = useState([]);
  const [inviteId, setInviteId] = useState('');

  useEffect(() => {
    const loadGuests = async () => {
      try {
        const data = await fetchJsonSafe(`/api/live-stream-guest/${streamId}`);
        setGuests(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Live guests fetch error:', err?.message || err);
      }
    };

    loadGuests();
    const interval = setInterval(loadGuests, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const inviteGuest = async () => {
    if (!inviteId.trim()) return;
    try {
      await fetchJsonSafe('/api/live-stream-guest/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, userId: inviteId, invitedBy: userId }),
      });
      setInviteId('');
      const data = await fetchJsonSafe(`/api/live-stream-guest/${streamId}`);
      setGuests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Live guest invite error:', err?.message || err);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Fto Guests</div>
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <input
          value={inviteId}
          onChange={(e) => setInviteId(e.target.value)}
          placeholder="ID e userit për ftesë"
          style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button
          type="button"
          onClick={inviteGuest}
          style={{ marginLeft: 8, padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          Fto
        </button>
      </div>
      <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 15 }}>
        {guests.map((g) => (
          <div key={g.id} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 'bold' }}>{g.userId}</span> - {g.status}
          </div>
        ))}
      </div>
    </div>
  );
}
