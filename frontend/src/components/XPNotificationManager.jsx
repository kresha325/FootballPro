import { useState, useEffect } from 'react';
import { SparklesIcon, TrophyIcon } from '@heroicons/react/24/solid';

const XPNotification = ({ xp, reason, levelUp, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
      <div className={`${levelUp ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-purple-600'} text-white rounded-lg shadow-2xl p-4 min-w-[300px]`}>
        <div className="flex items-center gap-3">
          {levelUp ? (
            <TrophyIcon className="h-10 w-10 animate-bounce" />
          ) : (
            <SparklesIcon className="h-8 w-8" />
          )}
          <div className="flex-1">
            {levelUp ? (
              <>
                <p className="font-bold text-lg">Level Up! 🎉</p>
                <p className="text-sm opacity-90">You reached Level {levelUp.newLevel}</p>
              </>
            ) : (
              <>
                <p className="font-bold">+{xp} XP</p>
                <p className="text-sm opacity-90">{reason}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const XPNotificationManager = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleXPEarned = (event) => {
      const { xp, reason, levelUp } = event.detail;
      const id = Date.now();
      setNotifications(prev => [...prev, { id, xp, reason, levelUp }]);
    };

    window.addEventListener('xp-earned', handleXPEarned);
    return () => window.removeEventListener('xp-earned', handleXPEarned);
  }, []);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {notifications.map((notif, index) => (
        <div key={notif.id} style={{ top: `${80 + index * 100}px` }} className="fixed right-6 z-50">
          <XPNotification
            xp={notif.xp}
            reason={notif.reason}
            levelUp={notif.levelUp}
            onClose={() => removeNotification(notif.id)}
          />
        </div>
      ))}
    </>
  );
};

// Helper function to trigger XP notification
export const showXPNotification = (xp, reason, levelUp = null) => {
  window.dispatchEvent(new CustomEvent('xp-earned', {
    detail: { xp, reason, levelUp }
  }));
};

export default XPNotificationManager;
