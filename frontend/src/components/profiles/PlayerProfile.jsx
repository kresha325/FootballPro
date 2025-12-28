import React from 'react';
import { ClubBadge } from '../../utils/clubLogos';

const PlayerProfile = ({ profile, stats, isOwner }) => {
  const playerStats = profile.stats || {};

  return (
    <div className="space-y-6">
      {/* Player Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Player Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{playerStats.height || '-'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Height (cm)</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{playerStats.weight || '-'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Weight (kg)</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">#{playerStats.jerseyNumber || '-'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Jersey</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{playerStats.preferredFoot || '-'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Foot</div>
          </div>
        </div>

        {/* Additional Stats */}
        {playerStats.goals !== undefined && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">⚽ {playerStats.goals || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Goals</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">🎯 {playerStats.assists || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Assists</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">🏃 {playerStats.matches || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Matches</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">📊 {playerStats.rating || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Career History */}
      {profile.careerHistory && profile.careerHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏆</span> Career History
          </h3>
          <div className="space-y-4">
            {profile.careerHistory.map((club, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <ClubBadge clubName={club.club} size="md" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{club.club}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{club.period}</p>
                  {club.achievements && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{club.achievements}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills & Strengths */}
      {playerStats.skills && playerStats.skills.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⭐</span> Skills & Strengths
          </h3>
          <div className="flex flex-wrap gap-2">
            {playerStats.skills.map((skill, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
