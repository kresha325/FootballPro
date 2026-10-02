import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, createLocalTracks, Track } from 'livekit-client';
import { livekitAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Group AV call via LiveKit room `group-{conversationId}` (same ACL as mobile).
 */
export default function GroupLiveKitCall({
  conversationId,
  title = 'Grup',
  audioOnly = false,
  onClose,
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState('connecting'); // connecting | connected | error | ended
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!!audioOnly);
  const [remoteTiles, setRemoteTiles] = useState([]); // { id, name, hasVideo }
  const [participantCount, setParticipantCount] = useState(1);

  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const intentionalLeaveRef = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const remoteAudioEls = useRef([]);

  const roomName = `group-${conversationId}`;

  const refreshRemotes = useCallback((room) => {
    if (!room) return;
    const tiles = [];
    room.remoteParticipants.forEach((p) => {
      let hasVideo = false;
      p.trackPublications.forEach((pub) => {
        if (pub.kind === Track.Kind.Video && pub.track && !pub.isMuted) hasVideo = true;
      });
      tiles.push({
        id: p.identity || p.sid,
        name: p.name || p.identity || 'Anëtar',
        hasVideo,
      });
    });
    setRemoteTiles(tiles);
    setParticipantCount(1 + tiles.length);
  }, []);

  const attachRemoteMedia = useCallback((room) => {
    if (!room) return;
    remoteAudioEls.current.forEach((el) => {
      try {
        el.remove();
      } catch (_e) {
        /* ignore */
      }
    });
    remoteAudioEls.current = [];

    room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        const track = pub.track;
        if (!track) return;
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          remoteAudioEls.current.push(el);
        }
        if (track.kind === Track.Kind.Video) {
          const videoEl = remoteVideoRefs.current.get(p.identity || p.sid);
          if (videoEl) track.attach(videoEl);
        }
      });
    });
    refreshRemotes(room);
  }, [refreshRemotes]);

  const attachLocalPreview = useCallback(() => {
    const videoTrack = localTracksRef.current.find((t) => t.kind === 'video');
    if (videoTrack && localVideoRef.current) {
      videoTrack.attach(localVideoRef.current);
    }
  }, []);

  const leave = useCallback(async () => {
    intentionalLeaveRef.current = true;
    try {
      localTracksRef.current.forEach((t) => {
        try {
          t.stop();
          t.detach();
        } catch (_e) {
          /* ignore */
        }
      });
      localTracksRef.current = [];
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      remoteAudioEls.current.forEach((el) => {
        try {
          el.remove();
        } catch (_e) {
          /* ignore */
        }
      });
      remoteAudioEls.current = [];
    } finally {
      setStatus('ended');
      onClose?.();
    }
  }, [onClose]);

  useEffect(() => {
    if (!conversationId || !user?.id) {
      setError('Mungon conversationId.');
      setStatus('error');
      return undefined;
    }

    let cancelled = false;
    intentionalLeaveRef.current = false;

    (async () => {
      try {
        setStatus('connecting');
        setError('');
        const participantName =
          `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || String(user.id);
        const tokenRes = await livekitAPI.createToken({
          roomName,
          participantName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          metadata: { userId: user.id, conversationId },
        });
        const wsUrl = tokenRes?.data?.wsUrl;
        const token = tokenRes?.data?.token;
        if (!wsUrl || !token) throw new Error('LiveKit token i pavlefshëm');

        if (cancelled) return;

        const room = new Room();
        room.on(RoomEvent.TrackSubscribed, () => attachRemoteMedia(room));
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
          attachRemoteMedia(room);
        });
        room.on(RoomEvent.ParticipantConnected, () => refreshRemotes(room));
        room.on(RoomEvent.ParticipantDisconnected, () => refreshRemotes(room));
        room.on(RoomEvent.Disconnected, () => {
          if (intentionalLeaveRef.current) return;
          setStatus('ended');
          onClose?.();
        });

        await room.connect(wsUrl, token, { autoSubscribe: true });
        if (cancelled) {
          await room.disconnect();
          return;
        }

        const localTracks = await createLocalTracks({
          audio: true,
          video: audioOnly
            ? false
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
              },
        });
        for (const track of localTracks) {
          await room.localParticipant.publishTrack(track);
        }
        localTracksRef.current = localTracks;
        roomRef.current = room;
        attachRemoteMedia(room);
        requestAnimationFrame(() => attachLocalPreview());
        setStatus('connected');
      } catch (err) {
        console.error('Group LiveKit call failed:', err);
        if (!cancelled) {
          setError(err?.response?.data?.msg || err?.message || 'Thirrja e grupit dështoi.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      intentionalLeaveRef.current = true;
      localTracksRef.current.forEach((t) => {
        try {
          t.stop();
          t.detach();
        } catch (_e) {
          /* ignore */
        }
      });
      localTracksRef.current = [];
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
      remoteAudioEls.current.forEach((el) => {
        try {
          el.remove();
        } catch (_e) {
          /* ignore */
        }
      });
      remoteAudioEls.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once per conversation
  }, [conversationId, user?.id, audioOnly, roomName]);

  useEffect(() => {
    if (status === 'connected') attachLocalPreview();
  }, [status, videoOff, attachLocalPreview]);

  useEffect(() => {
    if (status !== 'connected' || !roomRef.current) return;
    // Re-attach remote videos when tile list changes (refs remount)
    const t = requestAnimationFrame(() => attachRemoteMedia(roomRef.current));
    return () => cancelAnimationFrame(t);
  }, [remoteTiles, status, attachRemoteMedia]);

  const setTrackEnabled = (kind, enabled) => {
    const track = localTracksRef.current.find((t) => t.kind === kind);
    if (!track) return;
    if (typeof track.mute === 'function' && typeof track.unmute === 'function') {
      if (enabled) track.unmute();
      else track.mute();
      return;
    }
    if (typeof track.setEnabled === 'function') track.setEnabled(enabled);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setTrackEnabled('audio', !next);
  };

  const toggleVideo = () => {
    if (audioOnly) return;
    const next = !videoOff;
    setVideoOff(next);
    setTrackEnabled('video', !next);
    if (!next) requestAnimationFrame(() => attachLocalPreview());
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="font-semibold">{title || 'Thirrje grupi'}</h3>
          <p className="text-xs text-white/60">
            {status === 'connecting'
              ? 'Duke u lidhur…'
              : status === 'error'
                ? 'Gabim'
                : `${participantCount} pjesëmarrës · LiveKit`}
          </p>
        </div>
        <button
          type="button"
          onClick={leave}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
        >
          Mbyll
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col p-3 sm:p-5">
        {status === 'error' ? (
          <div className="m-auto max-w-md rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-center">
            <p className="font-semibold text-red-200">{error}</p>
            <button
              type="button"
              onClick={leave}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Kthehu
            </button>
          </div>
        ) : status === 'connecting' ? (
          <div className="m-auto text-center text-white/70">Duke u lidhur me dhomën e grupit…</div>
        ) : (
          <>
            <div
              className={`grid min-h-0 flex-1 gap-2 ${
                remoteTiles.length <= 1
                  ? 'grid-cols-1'
                  : remoteTiles.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {remoteTiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900">
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-white/50">
                    {audioOnly ? 'Thirrje audio — duke pritur anëtarët…' : 'Duke pritur anëtarët…'}
                  </p>
                </div>
              ) : (
                remoteTiles.map((tile) => (
                  <div
                    key={tile.id}
                    className="relative overflow-hidden rounded-2xl bg-slate-900"
                  >
                    <video
                      ref={(el) => {
                        if (el) remoteVideoRefs.current.set(tile.id, el);
                        else remoteVideoRefs.current.delete(tile.id);
                      }}
                      autoPlay
                      playsInline
                      className={`h-full min-h-[180px] w-full object-cover ${
                        tile.hasVideo && !audioOnly ? '' : 'hidden'
                      }`}
                    />
                    {(!tile.hasVideo || audioOnly) && (
                      <div className="flex h-full min-h-[180px] items-center justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--xt-color-gold,#9A6B12)] text-xl font-bold text-white">
                          {(tile.name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs">
                      {tile.name}
                    </span>
                  </div>
                ))
              )}
            </div>

            {!audioOnly && !videoOff ? (
              <div className="absolute bottom-24 right-4 h-28 w-20 overflow-hidden rounded-xl border border-white/20 bg-black shadow-lg sm:bottom-28 sm:right-6 sm:h-36 sm:w-28">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover mirror -scale-x-100"
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {status === 'connected' || status === 'connecting' ? (
        <div className="flex items-center justify-center gap-4 border-t border-white/10 px-4 py-4">
          <button
            type="button"
            onClick={toggleMute}
            className={`rounded-full px-4 py-3 text-sm font-bold ${
              muted ? 'bg-red-600' : 'bg-white/15 hover:bg-white/25'
            }`}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          {!audioOnly ? (
            <button
              type="button"
              onClick={toggleVideo}
              className={`rounded-full px-4 py-3 text-sm font-bold ${
                videoOff ? 'bg-red-600' : 'bg-white/15 hover:bg-white/25'
              }`}
            >
              {videoOff ? 'Kamera on' : 'Kamera off'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={leave}
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold hover:bg-red-500"
          >
            Mbylle
          </button>
        </div>
      ) : null}
    </div>
  );
}
