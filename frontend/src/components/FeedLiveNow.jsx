import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { streamsAPI } from '../services/api';
import { dedupeLiveByStreamer } from '../utils/liveStreams';

const POLL_MS = 8000;
const LIMIT = 12;

const rawApi = import.meta.env.VITE_API_URL || '';
const siteRoot = rawApi.replace(/\/api\/?$/i, '').replace(/\/$/, '');

function resolvePhotoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!siteRoot) return u.startsWith('/') ? u : `/${u}`;
  return siteRoot + (u.startsWith('/') ? u : `/${u}`);
}

function streamPhoto(stream) {
  const s = stream?.streamer;
  if (!s) return null;
  if (s.photoUrl) return resolvePhotoUrl(s.photoUrl);
  const p = s.Profile?.profilePhoto;
  return resolvePhotoUrl(p);
}

export default function FeedLiveNow() {
  const navigate = useNavigate();
  const [liveStreams, setLiveStreams] = useState([]);
  const socketRef = useRef(null);

  const fetchLive = async () => {
    try {
      const res = await streamsAPI.getStreams({ isLive: true, limit: LIMIT });
      const list = Array.isArray(res.data) ? res.data : [];
      setLiveStreams(dedupeLiveByStreamer(list.filter((s) => s.isLive)));
    } catch (e) {
      console.error('FeedLiveNow: failed to fetch live streams', e);
      setLiveStreams([]);
    }
  };

  useEffect(() => {
    fetchLive();

    const apiRoot = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '') || window.location.origin;
    try {
      socketRef.current = io(apiRoot, { transports: ['websocket'], reconnectionAttempts: 5 });
      socketRef.current.on('connect', () => {
        try {
          socketRef.current.emit('subscribe:streams');
        } catch (_e) {
          /* ignore */
        }
      });
      socketRef.current.on('stream:created', fetchLive);
      socketRef.current.on('stream:updated', fetchLive);
      socketRef.current.on('stream:ended', fetchLive);
    } catch (_e) {
      /* fallback: polling only */
    }

    const interval = setInterval(fetchLive, POLL_MS);
    return () => {
      clearInterval(interval);
      try {
        if (socketRef.current) socketRef.current.disconnect();
      } catch (_e) {
        /* ignore */
      }
    };
  }, []);

  if (!liveStreams.length) return null;

  return (
    <section
      className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3"
      aria-label="Live Now"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-extrabold text-red-800 dark:text-red-300 tracking-tight">Live Now</h2>
        <button
          type="button"
          onClick={() => navigate('/streams')}
          className="text-sm font-bold text-teal-700 dark:text-teal-400 hover:underline"
        >
          See all
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar-mobile" style={{ WebkitOverflowScrolling: 'touch' }}>
        {liveStreams.map((stream) => {
          const streamer = stream?.streamer || {};
          const name =
            `${streamer.firstName || ''} ${streamer.lastName || ''}`.trim() || stream?.title || 'Live';
          const photo = streamPhoto(stream);
          return (
            <button
              key={stream.id}
              type="button"
              onClick={() => navigate(`/live/${stream.id}`)}
              className="flex-shrink-0 flex flex-col items-center w-[96px] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg py-1"
            >
              <div className="relative">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border-2 border-red-500 bg-gray-200 dark:bg-gray-700"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-red-500 bg-red-700 flex items-center justify-center text-white font-bold text-lg">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="mt-1.5 text-xs font-bold text-gray-900 dark:text-gray-100 text-center line-clamp-2 w-full">
                {name}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-extrabold text-red-600 dark:text-red-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                LIVE
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
