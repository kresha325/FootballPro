import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Room, RoomEvent } from 'livekit-client';
import { livekitAPI, streamsAPI } from '../services/api';
import {
  buildYoutubeChannelLiveEmbedUrl,
  buildYoutubeChannelLiveWatchUrl,
} from '../utils/youtubeLiveEmbed';

export default function LiveStreamViewer() {
  const { streamId } = useParams();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [playback, setPlayback] = useState('livekit'); // 'livekit' | 'youtube' | 'recording'
  const [recordingUrl, setRecordingUrl] = useState('');
  const [youtubeChannelId, setYoutubeChannelId] = useState(null);
  const roomRef = useRef(null);

  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const attachTrack = (track) => {
      if (track.kind === 'video' && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
      if (track.kind === 'audio' && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
    };

    const init = async () => {
      if (!streamId) return;
      setConnecting(true);
      setError('');
      setPlayback('livekit');
      setYoutubeChannelId(null);

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
            setStream(streamData);
            if (mounted) setConnecting(false);
            return;
          }
          setError('This stream is not live right now.');
          setConnecting(false);
          return;
        }

        await streamsAPI.joinStream(streamId);

        if (streamData.youtubeChannelId) {
          setPlayback('youtube');
          setYoutubeChannelId(streamData.youtubeChannelId);
          if (mounted) setConnecting(false);
          return;
        }

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
            if (publication.track) {
              attachTrack(publication.track);
            }
          });
        });

        if (mounted) setConnecting(false);
      } catch (err) {
        console.error('Live viewer init failed:', err);
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

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [streamId]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Viewer</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {stream?.title || 'Live stream'}
        </p>
        {stream?.streamer ? (
          <p className="text-sm text-gray-500 mt-1">
            By {stream.streamer.firstName || ''} {stream.streamer.lastName || ''} | Viewers: {stream.viewers || 0}
          </p>
        ) : null}
        {playback === 'youtube' && youtubeChannelId ? (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold mb-1">YouTube Live — si funksionon</p>
            <p className="text-xs leading-relaxed">
              FootballPro shënon stream-in si LIVE, por videoja vjen nga <strong>YouTube</strong>. Nëse shikon
              «This video is unavailable», në YouTube <strong>nuk ke filluar ende</strong> transmetimin për kanalin{' '}
              <span className="font-mono">{youtubeChannelId}</span>.
            </p>
            <p className="text-xs mt-2 leading-relaxed">
              Streameri: nis LIVE në <strong>YouTube Studio</strong> ose <strong>OBS</strong> (i njëjti kanal), pastaj
              rifresko këtë faqe.
            </p>
            <a
              href={buildYoutubeChannelLiveWatchUrl(youtubeChannelId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-semibold text-teal-700 dark:text-teal-300 underline"
            >
              Hap kanalin në YouTube →
            </a>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>
        ) : null}

        {connecting ? (
          <div className="mt-6 text-gray-600 dark:text-gray-300">Connecting to live stream…</div>
        ) : null}

        <div className="mt-4 rounded-lg overflow-hidden bg-black min-h-[320px] flex items-center justify-center">
          {playback === 'recording' && recordingUrl ? (
            <video src={recordingUrl} controls autoPlay className="w-full h-auto" />
          ) : playback === 'youtube' && youtubeChannelId ? (
            <iframe
              title="YouTube Live"
              className="w-full aspect-video"
              src={buildYoutubeChannelLiveEmbedUrl(youtubeChannelId)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline controls className="w-full h-auto" />
              <audio ref={remoteAudioRef} autoPlay playsInline />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
