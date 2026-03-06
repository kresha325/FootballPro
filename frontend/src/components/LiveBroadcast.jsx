import React, { useRef, useState } from 'react';
import { startBroadcast } from '../mediasoupClient';
import { useAuth } from '../contexts/AuthContext';
import { postsAPI } from '../services/api';

export default function LiveBroadcast({ streamId }) {
  const localVideoRef = useRef(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [broadcastSession, setBroadcastSession] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const { user } = useAuth();

  const start = async () => {
    setError('');
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setBroadcasting(true);
      const session = await startBroadcast(stream, streamId || (user && user.id), user && user.id);
      setBroadcastSession(session);

      // Start recording locally (for optional save/share)
      try {
        const options = {};
        let mime = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'video/webm;codecs=vp8,opus';
        }
        if (!MediaRecorder.isTypeSupported(mime)) {
          mime = 'video/webm';
        }
        if (MediaRecorder.isTypeSupported(mime)) options.mimeType = mime;

        const mr = new MediaRecorder(stream, options);
        const chunks = [];
        mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        mr.onstop = async () => {
          const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
          setRecordedBlob(blob);
          try {
            // Upload temp to server for preview/share decision
            const fd = new FormData();
            fd.append('video', new File([blob], 'live-session.webm', { type: blob.type }));
            const res = await streamsAPI.uploadTemp(fd);
            const tempUrl = res.data && res.data.tempUrl;
            if (tempUrl) {
              setRecordedBlobUrl(tempUrl);
            } else {
              setRecordedBlobUrl(URL.createObjectURL(blob));
            }
          } catch (uploadErr) {
            console.warn('Temp upload failed, using local preview', uploadErr);
            setRecordedBlobUrl(URL.createObjectURL(blob));
          }
          setShowStopModal(true);
        };
        mr.start(1000);
        mediaRecorderRef.current = mr;
        recordedChunksRef.current = chunks;
      } catch (recErr) {
        console.warn('Recording not supported:', recErr);
      }
    } catch (err) {
      setError('Nuk mund të nisësh transmetimin: ' + (err.message || err));
      setBroadcasting(false);
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    setLoading(true);
    try {
      // Stop media recorder if recording
      try {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') mr.stop();
      } catch (e) {}

      // Stop local tracks
      const stream = localVideoRef.current && localVideoRef.current.srcObject;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(t => t.stop());
      }

      // Close mediasoup send transport/socket if available
      if (broadcastSession) {
        try {
          if (broadcastSession.sendTransport && typeof broadcastSession.sendTransport.close === 'function') {
            broadcastSession.sendTransport.close();
          }
        } catch (e) {}
        try {
          if (broadcastSession.socket) broadcastSession.socket.disconnect();
        } catch (e) {}
      }

      setBroadcasting(false);
    } catch (err) {
      console.error('Error stopping broadcast:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (share) => {
    setShowStopModal(false);
    if (share && recordedBlob) {
      try {
        const fd = new FormData();
        fd.append('video', new File([recordedBlob], 'live-session.webm', { type: recordedBlob.type }));
        fd.append('content', 'Live session');
        await postsAPI.createPost(fd);
        alert('Transmetimi u ndau dhe u ruajt në gallery!');
      } catch (err) {
        console.error('Share upload failed:', err);
        alert('Ndryshimi në upload dështoi');
      }
    } else {
      // Don't share: discard recorded blob
      setRecordedBlob(null);
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl);
        setRecordedBlobUrl(null);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-center">Nis Transmetim Live (MediaSoup)</h2>
      <video ref={localVideoRef} autoPlay muted playsInline className="w-full aspect-video rounded shadow bg-black" />
      {!broadcasting && (
        <button
          onClick={start}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold w-full max-w-xs text-lg shadow-md hover:bg-red-700 transition-colors"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              Duke nisur...
            </span>
          ) : 'Nis Live'}
        </button>
      )}
      {broadcasting && <div className="text-green-600 font-bold text-lg">Transmetimi është LIVE!</div>}
      {broadcasting && (
        <div className="w-full max-w-xs">
          <button
            onClick={stop}
            className="mt-2 w-full px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold shadow-md hover:bg-gray-900 transition-colors"
            disabled={loading}
          >
            Mbyll Live
          </button>
        </div>
      )}

      {/* Stop modal: ask to share or not */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-2">Transmetimi u mbyll</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Doni të ndani këtë sesion në feed dhe ta ruani në galeri?</p>
            {recordedBlobUrl && (
              <video src={recordedBlobUrl} controls className="w-full mb-3 rounded bg-black" />
            )}
            <div className="flex gap-3">
              <button onClick={() => handleShare(true)} className="flex-1 bg-green-600 text-white py-2 rounded">Share (Ruaj)</button>
              <button onClick={() => handleShare(false)} className="flex-1 bg-red-500 text-white py-2 rounded">Don't share (Fshi)</button>
            </div>
          </div>
        </div>
      )}
      {error && <div className="text-red-600 text-center text-sm bg-red-100 rounded p-2 w-full">{error}</div>}
    </div>
  );
}
