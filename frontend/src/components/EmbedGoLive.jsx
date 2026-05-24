import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Room, createLocalTracks, RoomEvent } from 'livekit-client';
import { livekitAPI, profileAPI, streamsAPI } from '../services/api';
import { buildYoutubeChannelLiveEmbedUrl } from '../utils/youtubeLiveEmbed';
import { normalizeYoutubeChannelId } from '../utils/youtubeChannel';

function postToNative(payload) {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  } catch (_e) {
    /* not in WebView */
  }
}

/**
 * Broadcaster për mobile WebView dhe web: LiveKit nëse është konfiguruar,
 * përndryshe udhëzime YouTube/OBS (kanali nga profili).
 */
export default function EmbedGoLive() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const streamIdFromQuery = parseInt(params.get('streamId') || '', 10);
  const skipConfirm = params.get('confirmed') === '1';

  const [streamId, setStreamId] = useState(Number.isFinite(streamIdFromQuery) ? streamIdFromQuery : null);
  const [stream, setStream] = useState(null);
  const [broadcastStarted, setBroadcastStarted] = useState(skipConfirm);
  const [confirmYoutubeId, setConfirmYoutubeId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(!skipConfirm);
  const [phase, setPhase] = useState('init'); // init | livekit | youtube | error | ended | confirm
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [uploadingReplay, setUploadingReplay] = useState(false);
  const [replaySaved, setReplaySaved] = useState(false);

  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const tracksRef = useRef([]);

  const title = params.get('title')?.trim() || 'Live Stream';
  const description = params.get('description')?.trim() || '';

  const stopTracks = useCallback(() => {
    tracksRef.current.forEach((t) => {
      try {
        t.stop();
      } catch (_e) {
        /* ignore */
      }
    });
    tracksRef.current = [];
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const endBroadcast = useCallback(async () => {
    setEnding(true);
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      stopTracks();
      if (streamId) {
        await streamsAPI.endStream(streamId);
      }
      setPhase('ended');
      postToNative({ type: 'goLiveEnded', streamId });
    } catch (err) {
      console.error('endBroadcast:', err);
      setError(err?.response?.data?.error || err?.message || 'Could not end stream');
    } finally {
      setEnding(false);
    }
  }, [streamId, stopTracks]);

  const startLiveKit = useCallback(
    async (id) => {
      const roomName = `stream-${id}`;
      const tokenRes = await livekitAPI.createToken({
        roomName,
        canPublish: true,
        canSubscribe: true,
        metadata: { streamId: id, role: 'broadcaster' },
      });

      const wsUrl = tokenRes?.data?.wsUrl;
      const token = tokenRes?.data?.token;
      if (!wsUrl || !token) {
        throw new Error('LiveKit token response is invalid');
      }

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        stopTracks();
      });

      await room.connect(wsUrl, token, { autoSubscribe: true });
      const localTracks = await createLocalTracks({ audio: true, video: true });
      tracksRef.current = localTracks;

      const videoTrack = localTracks.find((t) => t.kind === 'video');
      if (videoTrack && videoRef.current) {
        videoTrack.attach(videoRef.current);
      }

      for (const track of localTracks) {
        await room.localParticipant.publishTrack(track);
      }

      setPhase('livekit');
      postToNative({ type: 'goLiveStarted', streamId: id, mode: 'livekit' });
    },
    [stopTracks]
  );

  useEffect(() => {
    if (broadcastStarted) return undefined;
    let cancelled = false;
    (async () => {
      setConfirmLoading(true);
      try {
        if (Number.isFinite(streamIdFromQuery)) {
          const detail = await streamsAPI.getStream(streamIdFromQuery);
          if (!cancelled) {
            setConfirmYoutubeId(normalizeYoutubeChannelId(detail?.data?.youtubeChannelId) || null);
          }
        } else {
          const prof = await profileAPI.getMyProfile();
          if (!cancelled) {
            setConfirmYoutubeId(normalizeYoutubeChannelId(prof?.data?.youtubeChannelId) || null);
          }
        }
      } catch (_e) {
        if (!cancelled) setConfirmYoutubeId(null);
      } finally {
        if (!cancelled) setConfirmLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [broadcastStarted, streamIdFromQuery]);

  useEffect(() => {
    if (!broadcastStarted) return undefined;
    let cancelled = false;

    (async () => {
      setPhase('init');
      setError('');
      try {
        let id = streamId;
        if (!id) {
          const created = await streamsAPI.createStream({
            title,
            description,
            isPremium: false,
          });
          id = created?.data?.id;
          if (!id) throw new Error('Stream creation returned no id');
          if (!cancelled) setStreamId(id);
        }

        const detail = await streamsAPI.getStream(id);
        if (cancelled) return;
        const streamData = detail?.data;
        setStream(streamData);

        const markLive = async () => {
          try {
            await streamsAPI.startStream(id);
          } catch (_startErr) {
            /* may already be live */
          }
        };

        if (streamData?.youtubeChannelId) {
          await markLive();
          setPhase('youtube');
          postToNative({ type: 'goLiveStarted', streamId: id, mode: 'youtube' });
          return;
        }

        try {
          await startLiveKit(id);
          await markLive();
        } catch (lkErr) {
          console.warn('LiveKit broadcast failed:', lkErr);
          setPhase('youtube');
          setError(
            lkErr?.response?.data?.msg ||
              lkErr?.message ||
              'LiveKit nuk është konfiguruar. Vendos YouTube Channel ID te Settings, pastaj shtyp «Aktivizo LIVE».'
          );
          postToNative({ type: 'goLiveStarted', streamId: id, mode: 'instructions' });
        }
      } catch (err) {
        if (!cancelled) {
          setPhase('error');
          setError(err?.response?.data?.error || err?.message || 'Could not start broadcast');
          postToNative({ type: 'goLiveError', message: String(err?.message || err) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [broadcastStarted, streamId, title, description, startLiveKit]);

  useEffect(() => {
    return () => {
      stopTracks();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [stopTracks]);

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/streams');
  };

  const handleReplayUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !streamId) return;
    setUploadingReplay(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('streamId', String(streamId));
      fd.append('title', stream?.title || title);
      if (description) fd.append('description', description);
      await streamsAPI.uploadRecording(fd);
      setReplaySaved(true);
      postToNative({ type: 'goLiveReplaySaved', streamId });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Ngarkimi dështoi');
    } finally {
      setUploadingReplay(false);
    }
  };

  if (!broadcastStarted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-3">Konfirmo Go Live</h1>
        <p className="text-sm text-gray-300 mb-1">
          Titulli: <strong>{title}</strong>
        </p>
        {description ? <p className="text-xs text-gray-500 mb-4">{description}</p> : <div className="mb-4" />}
        {confirmLoading ? (
          <p className="text-gray-400 text-sm mb-6">Duke lexuar kanalin nga profili…</p>
        ) : confirmYoutubeId ? (
          <p className="text-sm text-teal-300 mb-6 text-center">
            YouTube (automatik nga profili):
            <br />
            <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-2 inline-block">{confirmYoutubeId}</code>
          </p>
        ) : (
          <p className="text-sm text-amber-200 mb-6 text-center">
            YouTube nuk është vendosur te Settings. Do përdoret LiveKit ose udhëzime OBS.
          </p>
        )}
        <button
          type="button"
          className="w-full py-3 rounded-lg bg-red-600 font-bold mb-3"
          onClick={() => setBroadcastStarted(true)}
        >
          Nis LIVE
        </button>
        <button type="button" className="w-full py-2 rounded-lg bg-gray-700" onClick={handleClose}>
          Anulo
        </button>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 max-w-md mx-auto">
        <p className="text-lg font-semibold mb-2 text-center">Transmetimi u mbyll</p>
        {replaySaved ? (
          <p className="text-teal-300 text-sm mb-4 text-center">
            Regjistrimi u ruajt te <strong>Videot Live</strong> të profilit (jo te upload-et normale).
          </p>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-4 text-center">
              Ke regjistrim nga telefoni/PC? Ngarkoje që të shfaqet te profili si video live.
            </p>
            <label className="w-full mb-3">
              <span className="block w-full py-3 px-4 rounded-lg bg-teal-700 text-center font-bold cursor-pointer">
                {uploadingReplay ? 'Duke ngarkuar…' : 'Ngarko regjistrimin live'}
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingReplay}
                onChange={handleReplayUpload}
              />
            </label>
          </>
        )}
        {error ? <p className="text-red-300 text-xs mb-3">{error}</p> : null}
        <button type="button" className="px-4 py-2 rounded-lg bg-gray-700" onClick={handleClose}>
          Mbyll
        </button>
      </div>
    );
  }

  if (phase === 'error' && !stream) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <p className="text-center text-red-300 mb-6">{error || 'Gabim'}</p>
        <button type="button" className="px-4 py-2 rounded-lg bg-gray-700" onClick={handleClose}>
          Mbyll
        </button>
      </div>
    );
  }

  const ytId = stream?.youtubeChannelId;
  const ytEmbed = ytId ? buildYoutubeChannelLiveEmbedUrl(ytId) : null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="min-w-0">
          <p className="font-bold truncate">{stream?.title || title}</p>
          <p className="text-xs text-gray-400">
            {phase === 'livekit' ? 'LiveKit · Duke transmetuar' : 'YouTube / udhëzime'}
          </p>
        </div>
        <button
          type="button"
          disabled={ending}
          onClick={endBroadcast}
          className="shrink-0 ml-2 px-3 py-1.5 rounded-lg bg-red-600 text-sm font-bold disabled:opacity-50"
        >
          {ending ? '…' : 'Mbyll LIVE'}
        </button>
      </div>

      {phase === 'livekit' ? (
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[70vh] object-contain" />
          <p className="absolute bottom-4 left-4 text-xs bg-black/60 px-2 py-1 rounded">
            Shikuesit: {stream?.viewers ?? 0}
          </p>
        </div>
      ) : (
        <div className="flex-1 p-4 overflow-y-auto">
          {error ? (
            <p className="text-amber-200 text-sm mb-4 rounded bg-amber-900/40 border border-amber-700 p-3">{error}</p>
          ) : null}

          {ytEmbed ? (
            <>
              <p className="text-sm text-gray-300 mb-3">
                Transmeto live në <strong>YouTube Studio / OBS</strong> për kanalin tënd. Shikuesit në app shohin embed-in
                kur stream-i është live në YouTube.
              </p>
              <iframe
                title="YouTube preview"
                className="w-full aspect-video rounded-lg border border-gray-700"
                src={ytEmbed}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </>
          ) : (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-300 space-y-3">
              <p className="font-semibold text-white">Si të transmetosh live</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Hap <strong>Settings → Profil</strong> dhe vendos <strong>YouTube Channel ID</strong> (UC…).</li>
                <li>Nis transmetimin në YouTube Studio ose OBS për atë kanal.</li>
                <li>Kthehu këtu — statusi në app është tashmë LIVE për ndjekësit.</li>
              </ol>
              <p className="text-xs text-gray-500">
                Opsionale: konfiguro LiveKit në server (LIVEKIT_URL) për transmetim direkt nga kamera e këtij ekrani.
              </p>
            </div>
          )}

          {stream?.streamKey ? (
            <div className="mt-4 rounded bg-gray-800 p-3 text-xs font-mono break-all">
              <p className="text-gray-400 mb-1">Stream key (OBS):</p>
              {stream.streamKey}
            </div>
          ) : null}

          {phase === 'youtube' && !stream?.youtubeChannelId ? (
            <button
              type="button"
              className="mt-4 w-full py-3 rounded-lg bg-teal-600 font-bold"
              onClick={async () => {
                try {
                  await streamsAPI.startStream(streamId);
                  postToNative({ type: 'goLiveStarted', streamId, mode: 'instructions' });
                  setError('');
                } catch (err) {
                  setError(err?.message || 'Nuk u aktivizua LIVE');
                }
              }}
            >
              Aktivizo LIVE për ndjekësit
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
