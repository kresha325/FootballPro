import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Room, RoomEvent } from 'livekit-client';
import { livekitAPI, streamsAPI } from '../services/api';

export default function LiveStreamViewer() {
  const { streamId } = useParams();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
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

      try {
        const streamRes = await streamsAPI.getStream(streamId);
        const streamData = streamRes?.data;
        setStream(streamData);

        if (!streamData?.isLive) {
          setError('This stream is not live right now.');
          setConnecting(false);
          return;
        }

        await streamsAPI.joinStream(streamId);

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

        {error ? (
          <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>
        ) : null}

        {connecting ? (
          <div className="mt-6 text-gray-600">Connecting to live stream...</div>
        ) : null}

        <div className="mt-4 rounded-lg overflow-hidden bg-black min-h-[320px] flex items-center justify-center">
          <video ref={remoteVideoRef} autoPlay playsInline controls className="w-full h-auto" />
          <audio ref={remoteAudioRef} autoPlay playsInline />
        </div>
      </div>
    </div>
  );
}
