import React, { useState, useEffect } from 'react';
import { clubMembersAPI } from '../../services/api';
import { Link } from 'react-router-dom';

const ClubProfile = ({ profile, stats, isOwner }) => {
  const clubData = profile.stats || {};
  const [clubMembers, setClubMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (profile.userId) {
      fetchClubMembers();
    }
  }, [profile.userId]);


  // Helper for absolute/relative URL
  const isAbsoluteUrl = url => /^https?:\/\//.test(url);
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');

  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="flex justify-center mb-6">
        <img
          src={
            profile.profilePhoto
              ? (isAbsoluteUrl(profile.profilePhoto)
                  ? profile.profilePhoto
                  : `${apiRoot}${profile.profilePhoto}`)
              : '/default-profile.png'
          }
          alt="Profile"
          className="w-32 h-32 rounded-full object-cover border-4 border-blue-400 shadow-lg"
          data-userid={profile.userId}
        />
      </div>

      {/* Club Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Club Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Founded</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.founded || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Stadium</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.stadium || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Capacity</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.capacity?.toLocaleString() || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">League</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.league || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Club Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">🏆</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.trophies || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trophies</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">👥</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.squadSize || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Squad Size</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">📊</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.ranking || 'N/A'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">League Ranking</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">💰</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.marketValue || 'N/A'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Market Value</div>
          </div>
        </div>
      </div>

      {/* About Club */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>ℹ️</span> About {profile.club || 'Club'}
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Achievements & Honors */}
      {clubData.achievements && clubData.achievements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏅</span> Achievements & Honors
          </h3>
          <div className="space-y-3">
            {clubData.achievements.map((achievement, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="text-3xl">🏆</div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{achievement.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{achievement.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Colors */}
      {clubData.colors && clubData.colors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎨</span> Team Colors
          </h3>
          <div className="flex gap-3">
            {clubData.colors.map((color, index) => (
              <div
                key={index}
                className="w-20 h-20 rounded-lg shadow-md border-2 border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: color }}
                title={color}
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* Contact & Social */}
      {profile.contact && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📞</span> Contact Information
          </h3>
          <div className="space-y-3">
            {profile.contact.phone && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.phone}</span>
              </div>
            )}
            {profile.contact.email && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.email}</span>
              </div>
            )}
            {profile.contact.website && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <a href={profile.contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {profile.contact.website}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubProfile;
