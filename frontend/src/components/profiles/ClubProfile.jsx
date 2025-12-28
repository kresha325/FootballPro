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

  const fetchClubMembers = async () => {
    try {
      const response = await clubMembersAPI.getClubMembers(profile.userId, 'approved');
      setClubMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching club members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  return (
    <div className="space-y-6">{/* Club Squad */}
      {!loadingMembers && clubMembers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>👥</span> Squad ({clubMembers.length})
            </h3>
            {isOwner && (
              <Link
                to="/club-roster"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Manage Roster →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubMembers.map((membership) => (
              <Link
                key={membership.id}
                to={`/profile/${membership.athleteId}`}
                className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {membership.athlete?.Profile?.profilePhoto ? (
                    <img
                      src={`http://localhost:5098${membership.athlete.Profile.profilePhoto}`}
                      alt={membership.athlete.firstName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    `${membership.athlete?.firstName?.[0] || '?'}${membership.athlete?.lastName?.[0] || ''}`
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                    {membership.athlete?.firstName} {membership.athlete?.lastName}
                  </h4>
                  <div className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {membership.position && <span>⚽ {membership.position}</span>}
                    {membership.jerseyNumber && <span>#{membership.jerseyNumber}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
};

export default ClubProfile;
