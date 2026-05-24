import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Room, RoomEvent } from 'livekit-client';
import { livekitAPI, streamsAPI } from '../services/api';
import { isMobileWeb } from '../utils/device';
import {
  buildYoutubeChannelLiveEmbedUrl,
  buildYoutubeChannelLiveWatchUrl,
} from '../utils/youtubeLiveEmbed';

function waitForRemoteVideo(room, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const hasVideo = () =>
      [...room.remoteParticipants.values()].some((p) =>
        [...p.trackPublications.values()].some(
          (pub) => pub.kind === 'video' && pub.track && pub.isSubscribed !== false
        )
      );

    if (hasVideo()) {
      resolve(true);
      return;
    }

    const onTrack = () => {
      if (hasVideo()) {
        cleanup();
        resolve(true);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(hasVideo());
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      room.off(RoomEvent.TrackSubscribed, onTrack);
    };

    room.on(RoomEvent.TrackSubscribed, onTrack);
  });
}

export default function LiveStreamViewer() {
  const { streamId } = useParams();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [playback, setPlayback] = useState('livekit');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [youtubeChannelId, setYoutubeChannelId] = useState(null);
  const roomRef = useRef(null);

  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const detachRoom = () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };

    const attachTrack = (track) => {
      if (track.kind === 'video' && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
      if (track.kind === 'audio' && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
    };

    const tryLiveKit = async () => {
      const roomName = `stream-${streamId}`;
      const tokenRes = await livekitAPI.createToken({
        roomName,
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
      });

      const wsUrl = tokenRes?.data?.wsUrl;
      const token = tokenRes?.data?.token;
      if (!wsUrl || !token) {
        throw new Error('Invalid LiveKit token response');
      }

      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, attachTrack);
      room.on(RoomEvent.Disconnected, () => {
        if (mounted) setConnecting(false);
      });

      await room.connect(wsUrl, token, { autoSubscribe: true });

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track) attachTrack(publication.track);
        });
      });

      return waitForRemoteVideo(room);
    };

    const init = async () => {
      if (!streamId) return;
      setConnecting(true);
      setError('');
      setPlayback('livekit');
      setYoutubeChannelId(null);
      detachRoom();

      try {
        const streamRes = await streamsAPI.getStream(streamId);
        const streamData = streamRes?.data;
        if (!mounted) return;
        setStream(streamData);

        if (!streamData?.isLive) {
          const rec = streamData?.videoUrl;
          if (rec) {
            const rawApi = import.meta.env.VITE_API_URL || '';
            const siteRoot = rawApi.replace(/\/api\/?$/i, '').replace(/\/$/, '');
            const full = /^https?:\/\//i.test(rec)
              ? rec
              : `${siteRoot}${rec.startsWith('/') ? rec : `/${rec}`}`;
            setRecordingUrl(full);
            setPlayback('recording');
            setConnecting(false);
            return;
          }
          setError('Ky stream nuk është live tani.');
          setConnecting(false);
          return;
        }

        await streamsAPI.joinStream(streamId);

        let liveKitOk = false;
        try {
          liveKitOk = await tryLiveKit();
        } catch (lkErr) {
          console.warn('LiveKit viewer:', lkErr);
          detachRoom();
        }

        if (!mounted) return;

        if (liveKitOk) {
          setPlayback('livekit');
          setConnecting(false);
          return;
        }

        detachRoom();

        if (streamData.youtubeChannelId) {
          setPlayback('youtube');
          setYoutubeChannelId(streamData.youtubeChannelId);
          setConnecting(false);
          return;
        }

        setError('Nuk ka video live. Streameri duhet të jetë duke transmetuar (LiveKit).');
        setConnecting(false);
      } catch (err) {
        console.error('Live viewer init failed:', err);
        detachRoom();
        if (mounted) {
          setError(err?.response?.data?.msg || err?.message || 'Could not open live stream');
          setConnecting(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (streamId) {
        streamsAPI.leaveStream(streamId).catch(() => {});
      }
      detachRoom();
    };
  }, [streamId]);

  const mobileLayout = isMobileWeb();

  const renderPlayer = (mobile) => (
    <div
      className={`overflow-hidden bg-black w-full flex items-center justify-center ${
        mobile ? 'flex-1 min-h-0' : 'mt-3 sm:mt-4 rounded-lg aspect-video max-h-[min(70dvh,720px)]'
      }`}
    >
      {playback === 'recording' && recordingUrl ? (
        <video src={recordingUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
      ) : playback === 'youtube' && youtubeChannelId ? (
        <iframe
          title="YouTube Live"
          className="w-full h-full min-h-[200px] border-0"
          src={buildYoutubeChannelLiveEmbedUrl(youtubeChannelId)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            controls
            className={`w-full h-full ${mobile ? 'object-cover' : 'object-contain'}`}
          />
          <audio ref={remoteAudioRef} autoPlay playsInline />
        </>
      )}
    </div>
  );

  if (mobileLayout) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-black text-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-900/95 border-b border-gray-800 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-bold truncate text-sm">{stream?.title || 'Live stream'}</p>
            {stream?.streamer ? (
              <p className="text-xs text-gray-400 truncate">
                {stream.streamer.firstName || ''} {stream.streamer.lastName || ''} · {stream.viewers || 0} shikues
              </p>
            ) : null}
          </div>
          <Link to="/streams" className="text-xs text-teal-400 font-semibold shrink-0 py-1">
            ←
          </Link>
        </div>

        {playback === 'youtube' && youtubeChannelId ? (
          <p className="text-xs text-amber-200 px-3 py-2 bg-amber-950/60 shrink-0">
            YouTube Live — «Unavailable» = streameri nuk ka nisur LIVE në Studio/OBS.{' '}
            <a
              href={buildYoutubeChannelLiveWatchUrl(youtubeChannelId)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-teal-300"
            >
              Hap në YouTube
            </a>
          </p>
        ) : null}

        {error ? <p className="text-xs text-red-300 px-3 py-2 shrink-0">{error}</p> : null}
        {connecting ? <p className="text-xs text-gray-400 px-3 py-2 shrink-0">Duke u lidhur…</p> : null}

        {renderPlayer(true)}
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] sm:min-h-0 max-w-5xl mx-auto py-3 sm:py-6 px-3 sm:px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Live Viewer</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
              {stream?.title || 'Live stream'}
            </p>
            {stream?.streamer ? (
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {stream.streamer.firstName || ''} {stream.streamer.lastName || ''} · Shikues:{' '}
                {stream.viewers || 0}
              </p>
            ) : null}
          </div>
          <Link
            to="/streams"
            className="text-xs sm:text-sm text-teal-700 dark:text-teal-300 font-semibold shrink-0 py-1"
          >
            ← Streams
          </Link>
        </div>

        {playback === 'youtube' && youtubeChannelId ? (
          <div className="mt-2 sm:mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100">
            <p className="font-semibold mb-1 text-xs sm:text-sm">YouTube Live</p>
            <p className="text-xs leading-relaxed">
              Videoja vjen nga YouTube. «Unavailable» = streameri nuk ka nisur LIVE në YouTube Studio/OBS për kanalin{' '}
              <span className="font-mono break-all">{youtubeChannelId}</span>.
            </p>
            <a
              href={buildYoutubeChannelLiveWatchUrl(youtubeChannelId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-semibold text-teal-700 dark:text-teal-300 underline"
            >
              Hap në YouTube →
            </a>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        ) : null}

        {connecting ? (
          <p className="mt-4 sm:mt-6 text-gray-600 dark:text-gray-300 text-sm">Duke u lidhur me transmetimin…</p>
        ) : null}

        {renderPlayer(false)}
      </div>
    </div>
  );
}
