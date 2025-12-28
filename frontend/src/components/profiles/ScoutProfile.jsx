import React from 'react';

const ScoutProfile = ({ profile, stats, isOwner }) => {
  const scoutData = profile.stats || {};

  return (
    <div className="space-y-6">
      {/* Scouting Experience */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Scouting Experience</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{scoutData.yearsExperience || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Years Experience</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{scoutData.playersDiscovered || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Players Discovered</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{scoutData.successfulSigns || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Successful Signs</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{scoutData.regionsActive || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Regions Covered</div>
          </div>
        </div>
      </div>

      {/* Scouting Philosophy */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🔍</span> Scouting Approach
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Specializations */}
      {scoutData.specializations && scoutData.specializations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚽</span> Areas of Expertise
          </h3>
          <div className="flex flex-wrap gap-2">
            {scoutData.specializations.map((spec, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notable Discoveries */}
      {scoutData.notableDiscoveries && scoutData.notableDiscoveries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⭐</span> Notable Discoveries
          </h3>
          <div className="space-y-3">
            {scoutData.notableDiscoveries.map((discovery, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {discovery.playerName?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{discovery.playerName}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{discovery.position} • Signed to {discovery.club}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{discovery.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations & Networks */}
      {profile.careerHistory && profile.careerHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏢</span> Organizations & Networks
          </h3>
          <div className="space-y-3">
            {profile.careerHistory.map((org, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold">
                  {org.club?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{org.club}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{org.role} • {org.period}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regions Covered */}
      {scoutData.regions && scoutData.regions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🌍</span> Regions Covered
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {scoutData.regions.map((region, index) => (
              <div key={index} className="p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg text-center font-medium">
                📍 {region}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Rate */}
      {scoutData.successRate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📊</span> Performance Metrics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Success Rate</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{scoutData.successRate}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-teal-600 h-3 rounded-full"
                  style={{ width: `${scoutData.successRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutProfile;
