import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { streamsAPI } from '../services/api';
import { dedupeLiveByStreamer } from '../utils/liveStreams';
import { resolveStreamerPhotoUrl } from '../utils/avatarUrl';

const POLL_MS = 8000;
const LIMIT = 12;

const rawApi = import.meta.env.VITE_API_URL || '';
const siteRoot = rawApi.replace(/\/api\/?$/i, '').replace(/\/$/, '');

function streamPhoto(stream) {
  const s = stream?.streamer;
  if (!s) return null;
  if (s.photoUrl) return resolveStreamerPhotoUrl(s.photoUrl, siteRoot);
  return resolveStreamerPhotoUrl(s.Profile?.profilePhoto, siteRoot);
}

function streamerName(stream) {
  const streamer = stream?.streamer || {};
  return `${streamer.firstName || ''} ${streamer.lastName || ''}`.trim() || stream?.title || 'Live';
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
      socketRef.current = io(apiRoot, {
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 10,
      });
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
      className="mb-6 overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/40 via-slate-900/90 to-slate-950 px-4 py-4 shadow-lg shadow-red-900/20"
      aria-label="Live Now"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <h2 className="text-base font-black uppercase tracking-wide text-red-100">Live Now</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/streams')}
          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-white/10 transition hover:bg-white/15"
        >
          See all
        </button>
      </div>
      <div
        className="flex gap-4 overflow-x-auto pb-1 hide-scrollbar-mobile snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {liveStreams.map((stream) => {
          const name = streamerName(stream);
          const photo = streamPhoto(stream);
          const initial = name.charAt(0).toUpperCase();
          return (
            <button
              key={stream.id}
              type="button"
              onClick={() => navigate(`/live/${stream.id}`)}
              className="group flex w-[88px] shrink-0 snap-start flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-xl py-1"
            >
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-red-500 via-rose-400 to-orange-400 opacity-80 blur-[1px] group-hover:opacity-100" />
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="relative h-16 w-16 rounded-full border-2 border-slate-900 object-cover bg-slate-800"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-900 bg-gradient-to-br from-red-600 to-rose-700 text-xl font-black text-white">
                    {initial}
                  </div>
                )}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">
                  Live
                </span>
              </div>
              <span className="mt-2.5 line-clamp-2 w-full text-center text-xs font-bold leading-tight text-white">
                {name}
              </span>
              {(stream.viewers ?? 0) > 0 ? (
                <span className="mt-0.5 text-[10px] font-semibold text-slate-400">{stream.viewers} watching</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
