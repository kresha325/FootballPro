import { useState, useRef, useEffect } from 'react';
import { PhoneIcon, PhoneXMarkIcon } from '@heroicons/react/24/solid';

export default function IncomingCallModal({ caller, onAccept, onReject }) {
  const [ringing, setRinging] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    // Play ringtone (if you have an audio file)
    // audioRef.current?.play();

    return () => {
      // Stop ringtone
      // audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center animate-pulse">
        {/* Caller Avatar */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto flex items-center justify-center text-white text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">
          {caller.firstName?.[0]}{caller.lastName?.[0]}
        </div>

        {/* Caller Info */}
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          {caller.firstName} {caller.lastName}
        </h2>
        <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
          Duke ju thirrur me video...
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 sm:gap-6">
          {/* Reject Button */}
          <button
            onClick={onReject}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 active:bg-red-600 flex items-center justify-center text-white shadow-lg transform active:scale-95 transition"
            title="Refuzo"
            aria-label="Refuzo thirrjen"
          >
            <PhoneXMarkIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500 active:bg-green-600 flex items-center justify-center text-white shadow-lg transform active:scale-95 transition animate-bounce"
            title="Prano"
            aria-label="Prano thirrjen"
          >
            <PhoneIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>
        </div>

        {/* Hidden audio element for ringtone */}
        <audio ref={audioRef} loop>
          {/* <source src="/sounds/ringtone.mp3" type="audio/mpeg" /> */}
        </audio>
      </div>
    </div>
  );
}
