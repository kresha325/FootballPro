import React, { useRef, useState } from 'react';
import { startBroadcast } from '../mediasoupClient';
import { useAuth } from '../contexts/AuthContext';

export default function LiveBroadcast({ streamId }) {
  const localVideoRef = useRef(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      await startBroadcast(stream, streamId || (user && user.id), user && user.id);
    } catch (err) {
      setError('Nuk mund të nisësh transmetimin: ' + (err.message || err));
      setBroadcasting(false);
    } finally {
      setLoading(false);
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
      {error && <div className="text-red-600 text-center text-sm bg-red-100 rounded p-2 w-full">{error}</div>}
    </div>
  );
}
