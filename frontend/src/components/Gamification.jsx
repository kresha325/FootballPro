import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { gamificationAPI } from '../services/api';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useEffect, useState, useRef } from 'react';
    // DEBUG LOGS (vendosen jashtë JSX)

const Gamification = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  const isOwnProfile = !userId || userId === String(user.id);
  const [activeTab, setActiveTab] = useState('overview');
  const [gamificationData, setGamificationData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevAchievements = useRef([]);
  const prevBadges = useRef([]);
  const prevLevel = useRef(null);

  // Make these available everywhere
  const profileUser = gamificationData?.user;
  const userAchievements = gamificationData?.achievements;
  const userBadges = gamificationData?.badges;
  // Llogarit XP bar progresin (0-100%)
  const xpProgress = profileUser?.points ? ((profileUser.points % 1000) / 10) : 0;


  // Fetch gamification data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      const [gamifRes, achievementsRes, badgesRes, leaderboardRes] = await Promise.all([
        gamificationAPI.getUserStatus(userId),
        isOwnProfile ? gamificationAPI.getAchievements() : Promise.resolve({ data: [] }),
        isOwnProfile ? gamificationAPI.getBadges() : Promise.resolve({ data: [] }),
        gamificationAPI.getLeaderboard(),
      ]);
      setGamificationData(gamifRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard || leaderboardRes.data);
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (gamificationData) {
      console.log('GAMIFICATION DATA:', gamificationData);
    }
  }, [gamificationData]);

  // Detekto arritje/badge/level te reja dhe shfaq toast
  useEffect(() => {
    if (!gamificationData) return;
    // Level up
    if (prevLevel.current !== null && profileUser.level > prevLevel.current) {
      toast.success(`🎉 Level Up! You reached level ${profileUser.level}`);
    }
    prevLevel.current = profileUser.level;
    // Achievements
    if (userAchievements) {
      const newAch = userAchievements.filter(
        a => a.unlocked && !prevAchievements.current.some(pa => pa.id === a.id && pa.unlocked)
      );
      newAch.forEach(a => toast.info(`🏆 Achievement Unlocked: ${a.name}`));
      prevAchievements.current = userAchievements;
    }
    // Badges
    if (userBadges) {
      const newBadges = userBadges.filter(
        b => b.earned && !prevBadges.current.some(pb => pb.id === b.id && pb.earned)
      );
      newBadges.forEach(b => toast.success(`🔓 Badge Unlocked: ${b.name}`));
      prevBadges.current = userBadges;
    }
  }, [gamificationData]);

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-400 to-pink-500';
      case 'rare': return 'from-blue-400 to-cyan-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getRarityBorder = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-400 shadow-yellow-200';
      case 'epic': return 'border-purple-400 shadow-purple-200';
      case 'rare': return 'border-blue-400 shadow-blue-200';
      default: return 'border-gray-300 shadow-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!gamificationData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No gamification data available</p>
      </div>
    );
  }

  // Already destructured above if present, remove duplicate

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ToastContainer position="top-center" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      {/* Header & Tabs */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('overview')} className={activeTab==='overview' ? 'font-bold underline' : ''}>Overview</button>
          <button onClick={() => setActiveTab('achievements')} className={activeTab==='achievements' ? 'font-bold underline' : ''}>Achievements</button>
          <button onClick={() => setActiveTab('badges')} className={activeTab==='badges' ? 'font-bold underline' : ''}>Badges</button>
          <button onClick={() => setActiveTab('leaderboard')} className={activeTab==='leaderboard' ? 'font-bold underline' : ''}>Leaderboard</button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-gradient-to-br from-green-100 via-blue-50 to-purple-100 rounded-2xl shadow-xl p-10 mb-10 border border-green-200 animate-fade-in">
            <h2 className="text-3xl font-extrabold mb-2 text-green-700 flex items-center gap-2">
              <span>🎮</span> Welcome to your gamification dashboard!
            </h2>
            <p className="mb-8 text-lg text-gray-600">Track your progress, unlock achievements, and climb the leaderboard!</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <span className="text-lg font-semibold">XP:</span>
                  <span className="font-bold text-blue-700 text-xl">{profileUser.xp}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏅</span>
                  <span className="text-lg font-semibold">Level:</span>
                  <span className="font-bold text-purple-700 text-xl">{profileUser.level}</span>
                </div>
                <div className="mb-2">
                  <span className="text-lg font-semibold">Progress to next level:</span>
                  <div className="w-full bg-gray-200 rounded-full h-5 mt-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 h-5 rounded-full transition-all duration-700"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{xpProgress}%</span>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚽</span>
                  <span className="text-lg font-semibold">Matches played:</span>
                  <span className="font-bold text-gray-800">{gamificationData.matchesCount ?? '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <span className="text-lg font-semibold">Wins:</span>
                  <span className="font-bold text-gray-800">{gamificationData.winsCount ?? '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔓</span>
                  <span className="text-lg font-semibold">Unlocked achievements:</span>
                  <span className="font-bold text-green-700">{userAchievements?.filter(a => a.unlocked).length ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Achievements</h2>
            {(!userAchievements || userAchievements.length === 0) ? (
              <p className="text-gray-500">No achievements found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {userAchievements.map((ach) => (
                  <div key={ach.id} className="bg-white rounded-lg shadow p-4 flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🏆</span>
                      <span className="font-bold">{ach.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{ach.description}</p>
                    <span className={`text-xs mt-1 ${ach.unlocked ? 'text-green-600' : 'text-gray-400'}`}>{ach.unlocked ? 'Unlocked' : 'Locked'}</span>
                    {ach.unlocked && ach.unlockedAt && (
                      <p className="text-xs mt-1 opacity-75">{new Date(ach.unlockedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Badges</h2>
            {(!userBadges || userBadges.length === 0) ? (
              <p className="text-gray-500">No badges found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {userBadges.map((badge) => (
                  <div key={badge.id} className={`bg-white rounded-lg shadow p-4 flex flex-col items-center ${getRarityBorder(badge.rarity)}`}>
                    <span className="text-5xl mb-2">{badge.icon}</span>
                    <p className="font-bold">{badge.name}</p>
                    <p className="text-sm text-gray-500">{badge.description}</p>
                    <p className="text-xs mt-2 font-medium capitalize">{badge.rarity}</p>
                    {badge.earned ? (
                      <span className="text-green-600 text-xs mt-2">Earned</span>
                    ) : (
                      <span className="text-gray-400 text-xs mt-2">Locked</span>
                    )}
                    {badge.earned && badge.earnedAt && (
                      <p className="text-xs mt-1 opacity-75">
                        {new Date(badge.earnedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Global Leaderboard</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Badges
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaderboard.map((player) => (
                    <tr
                      key={player.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        player.isCurrentUser && 'bg-blue-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {player.rank === 1 && <span className="text-2xl">🥇</span>}
                          {player.rank === 2 && <span className="text-2xl">🥈</span>}
                          {player.rank === 3 && <span className="text-2xl">🥉</span>}
                          {player.rank > 3 && (
                            <span className="text-lg font-bold text-gray-700">#{player.rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {player.Profile?.profilePicture ? (
                            <img
                              src={getFullUrl(player.Profile.profilePicture)}
                              alt={player.firstName}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                              {player.firstName[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {player.firstName} {player.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{player.Profile?.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-semibold">
                          {player.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-gray-900">
                          {player.points.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {player.UserBadges?.slice(0, 3).map((ub, idx) => (
                            <span key={idx} className="text-xl" title={ub.Badge?.name}>
                              {ub.Badge?.icon}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gamification;
