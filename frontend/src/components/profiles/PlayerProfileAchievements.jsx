import React from 'react';

const PlayerProfileAchievements = ({ achievements }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Achievements & Trophies</h3>
      {achievements && achievements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {achievements.map((ach, idx) => (
            <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 flex flex-col items-center shadow">
              <div className="text-3xl mb-2">{ach.icon || '🏆'}</div>
              <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">{ach.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{ach.type}</div>
              <div className="text-xs text-gray-500 mb-2">{ach.description}</div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div className="bg-purple-500 h-3 rounded-full" style={{ width: `${ach.progress || 100}%` }}></div>
              </div>
              <span className="font-bold text-purple-700 dark:text-purple-300 mt-1">{ach.progress || 100}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No achievements found.</div>
      )}
    </div>
  );
};

export default PlayerProfileAchievements;
