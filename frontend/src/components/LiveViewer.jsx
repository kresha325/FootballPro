import React, { useRef, useState, useEffect } from 'react';
import { startViewer } from '../mediasoupClient';
import { useAuth } from '../contexts/AuthContext';

export default function LiveViewer({ streamId }) {
  const remoteVideoRef = useRef(null);
  const [viewing, setViewing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const { user } = useAuth();
  const socketRef = useRef(null);

  const start = async () => {
    setError('');
    setLoading(true);
    setEnded(false);
    try {
      const { stream, socket } = await startViewer(streamId, user && user.id);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setViewing(true);
      socketRef.current = socket;
      // Listen for streamEnded event
      socket.on('streamEnded', () => {
        setEnded(true);
        setViewing(false);
        setError('Ky transmetim është mbyllur nga broadcaster-i.');
      });
    } catch (err) {
      setError('Nuk mund të shfaqësh transmetimin: ' + (err.message || err));
      setViewing(false);
    } finally {
      setLoading(false);
    }
  };

  // Pastrim socket kur komponenti unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-center">Shiko Transmetim Live (MediaSoup)</h2>
      <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video rounded shadow bg-black" />
      {!viewing && !ended && (
        <button
          onClick={start}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold w-full max-w-xs text-lg shadow-md hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              Duke u lidhur...
            </span>
          ) : 'Shiko Live'}
        </button>
      )}
      {viewing && <div className="text-green-600 font-bold text-lg">Duke parë transmetimin!</div>}
      {ended && <div className="text-gray-700 font-semibold text-center bg-gray-100 rounded p-2 w-full">Ky transmetim është mbyllur nga broadcaster-i.</div>}
      {error && <div className="text-red-600 text-center text-sm bg-red-100 rounded p-2 w-full">{error}</div>}
    </div>
  );
}
