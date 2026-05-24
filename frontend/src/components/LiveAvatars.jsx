import React, { useEffect, useState, useRef } from 'react';
import { streamsAPI } from '../services/api';
import { dedupeLiveByStreamer } from '../utils/liveStreams';
import LiveViewer from './LiveViewer';
import io from 'socket.io-client';

export default function LiveAvatars({ onOpenViewer }) {
  const [liveStreams, setLiveStreams] = useState([]);
  const socketRef = useRef(null);

  const fetchLive = async () => {
    try {
      const res = await streamsAPI.getStreams({ isLive: true, limit: 12 });
      const live = dedupeLiveByStreamer((res.data || []).filter((s) => s.isLive));
      setLiveStreams(live);
    } catch (e) {
      console.error('Failed to fetch live streams', e);
    }
  };

  useEffect(() => {
    fetchLive();
    // Connect socket for realtime updates
    try {
      const server = (import.meta.env.VITE_API_URL || '').replace('/api','') || window.location.origin;
      socketRef.current = io(server, { transports: ['polling', 'websocket'], reconnectionAttempts: 10 });
      socketRef.current.on('connect', () => {
        // subscribe to stream events
        socketRef.current.emit('subscribe:streams');
      });
      socketRef.current.on('stream:created', fetchLive);
      socketRef.current.on('stream:updated', fetchLive);
      socketRef.current.on('stream:ended', fetchLive);
    } catch (e) {
      // ignore socket errors and fall back to polling
    }

    const interval = setInterval(fetchLive, 8000);
    return () => {
      clearInterval(interval);
      try { if (socketRef.current) socketRef.current.disconnect(); } catch (e) {}
    };
  }, []);

  if (liveStreams.length === 0) return null;

  return (
    <div className="fixed left-4 top-24 z-40 flex flex-col gap-3">
      {liveStreams.map(stream => (
        <button
          key={stream.id}
          onClick={() => onOpenViewer(stream)}
          className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-2 shadow hover:scale-105 transition-transform"
          title={`Watch ${stream.title}`}
        >
          <img src={stream.streamer.photoUrl || '/default-avatar.png'} alt={stream.streamer.firstName} className="w-12 h-12 rounded-full object-cover" />
          <div className="text-left text-sm leading-4">
            <div className="font-semibold text-gray-900 dark:text-white">{stream.streamer.firstName}</div>
            <div className="text-xs text-red-600">LIVE</div>
          </div>
        </button>
      ))}
    </div>
  );
}
