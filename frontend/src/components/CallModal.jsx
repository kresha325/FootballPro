import { useEffect, useRef } from 'react';

export default function CallModal({ isOpen, onClose, isVideo, remoteUser, localStream, remoteStream, onEnd }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md relative flex flex-col items-center">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-2xl font-bold"
          onClick={onEnd || onClose}
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-2">{isVideo ? 'Video Call' : 'Audio Call'} with {remoteUser?.name || 'User'}</h2>
        <div className="flex flex-col items-center gap-4 w-full">
          {isVideo ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-40 bg-black rounded mb-2" />
              <video ref={localVideoRef} autoPlay playsInline muted className="w-24 h-16 bg-black rounded absolute bottom-6 right-6 border-2 border-white" style={{zIndex: 60}} />
            </>
          ) : (
            <>
              <audio ref={remoteVideoRef} autoPlay />
              <audio ref={localVideoRef} autoPlay muted />
              <div className="w-24 h-24 rounded-full bg-blue-200 flex items-center justify-center text-4xl font-bold text-blue-700">
                {remoteUser?.name?.charAt(0) || '?'}
              </div>
            </>
          )}
        </div>
        <button
          className="mt-6 px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-semibold"
          onClick={onEnd || onClose}
        >
          End Call
        </button>
      </div>
    </div>
  );
}
