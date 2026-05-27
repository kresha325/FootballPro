import { useRef, useEffect } from 'react';
import { PhoneIcon, PhoneXMarkIcon } from '@heroicons/react/24/solid';

export default function IncomingCallModal({ caller, onAccept, onReject }) {
  const audioRef = useRef(null);
  const ringtoneRef = useRef({ ctx: null, gain: null, intervalId: null, resumeHandler: null, vibrateId: null });

  useEffect(() => {
    const startRingtone = () => {
      if (ringtoneRef.current.intervalId) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);

      const playBeep = () => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      };

      const begin = () => {
        playBeep();
        const intervalId = setInterval(playBeep, 1200);
        ringtoneRef.current.intervalId = intervalId;
      };

      ringtoneRef.current.ctx = ctx;
      ringtoneRef.current.gain = gain;

      if (ctx.state === 'suspended') {
        const resume = () => {
          ctx.resume().then(begin).catch(() => {});
          window.removeEventListener('click', resume);
          window.removeEventListener('touchstart', resume);
        };
        ringtoneRef.current.resumeHandler = resume;
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('touchstart', resume, { once: true });
      } else {
        begin();
      }

      const startVibration = () => {
        if (!navigator.vibrate) return;
        navigator.vibrate([200, 100, 200]);
        ringtoneRef.current.vibrateId = setInterval(() => {
          navigator.vibrate([200, 100, 200]);
        }, 1500);
      };

      // Chrome blocks vibrate until the user has interacted with the page.
      if (navigator.userActivation?.hasBeenActive) {
        startVibration();
      } else {
        const resumeVibrate = () => {
          startVibration();
          window.removeEventListener('click', resumeVibrate);
          window.removeEventListener('touchstart', resumeVibrate);
        };
        window.addEventListener('click', resumeVibrate, { once: true });
        window.addEventListener('touchstart', resumeVibrate, { once: true });
      }
    };

    const stopRingtone = () => {
      const { ctx, intervalId, resumeHandler, vibrateId } = ringtoneRef.current;
      if (intervalId) clearInterval(intervalId);
      if (vibrateId) clearInterval(vibrateId);
      if (resumeHandler) {
        window.removeEventListener('click', resumeHandler);
        window.removeEventListener('touchstart', resumeHandler);
      }
      if (ctx) ctx.close?.().catch(() => {});
      ringtoneRef.current = { ctx: null, gain: null, intervalId: null, resumeHandler: null, vibrateId: null };
    };

    startRingtone();
    return () => stopRingtone();
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
        <audio ref={audioRef} loop />
      </div>
    </div>
  );
}
