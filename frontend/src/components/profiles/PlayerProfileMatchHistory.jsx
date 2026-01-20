import React from 'react';

const PlayerProfileMatchHistory = ({ matches }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Recent Matches</h3>
      {matches && matches.length > 0 ? (
        <div className="space-y-6">
          {matches.map((match, idx) => (
            <div key={idx} className="border-b pb-4 mb-4 last:border-b-0 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-gray-900 dark:text-white">{match.date} vs {match.opponent}</div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${match.result === 'Win' ? 'bg-green-100 text-green-700' : match.result === 'Draw' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{match.result} {match.score}</div>
              </div>
              <div className="flex gap-6 text-sm text-gray-700 dark:text-gray-300 mb-2">
                <span>Goals: <b>{match.goals}</b></span>
                <span>Assists: <b>{match.assists}</b></span>
                <span>Minutes: <b>{match.minutes}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Performance Rating</span>
                <div className="w-32 bg-gray-200 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: `${(match.rating/10)*100}%` }}></div>
                </div>
                <span className="font-bold text-gray-900 dark:text-white ml-2">{match.rating}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No matches found.</div>
      )}
    </div>
  );
};

export default PlayerProfileMatchHistory;
