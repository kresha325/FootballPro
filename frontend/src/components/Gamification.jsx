import { useState, useEffect, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import {
  TrophyIcon,
  StarIcon,
  FireIcon,
  UserGroupIcon,
  ChartBarIcon,
  SparklesIcon,
  LockClosedIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';

const Gamification = () => {
    // Mbajme arritjet/badges e fituara per te detektuar te rejat
    const prevAchievements = useRef([]);
    const prevBadges = useRef([]);
    const prevLevel = useRef(null);
  const { user } = useAuth();
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  // Book view: shko direkt te arritjet
  const goToBook = () => setActiveTab('achievements');
  const [gamificationData, setGamificationData] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !userId || parseInt(userId) === user?.id;

  useEffect(() => {
    fetchData();
  }, [userId]);

  // Detekto arritje/badge/level te reja dhe shfaq toast
  useEffect(() => {
    if (!gamificationData) return;
    const { user: profileUser, achievements: userAchievements, badges: userBadges } = gamificationData;
    // Level up
    if (prevLevel.current !== null && profileUser.level > prevLevel.current) {
      toast.success(`🎉 Level Up! You reached level ${profileUser.level}`);
    }
    prevLevel.current = profileUser.level;
    // Achievements
    if (userAchievements && prevAchievements.current.length) {
      const newAch = userAchievements.filter(a => a.unlocked && !prevAchievements.current.some(pa => pa.id === a.id && pa.unlocked));
      newAch.forEach(a => toast.info(`🏆 Achievement Unlocked: ${a.name}`));
    }
    prevAchievements.current = userAchievements || [];
    // Badges
    if (userBadges && prevBadges.current.length) {
      const newBadges = userBadges.filter(b => b.earned && !prevBadges.current.some(pb => pb.id === b.id && pb.earned));
      newBadges.forEach(b => toast(`🔓 Badge Unlocked: ${b.name}`, { type: 'success' }));
    }
    prevBadges.current = userBadges || [];
  }, [gamificationData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [gamifRes, achievementsRes, badgesRes, leaderboardRes] = await Promise.all([
        api.get(`/gamification/user${userId ? `/${userId}` : ''}`),
        isOwnProfile ? api.get('/gamification/achievements') : Promise.resolve({ data: [] }),
        isOwnProfile ? api.get('/gamification/badges') : Promise.resolve({ data: [] }),
        api.get('/gamification/leaderboard?limit=50'),
      ]);

      setGamificationData(gamifRes.data);
      setAchievements(achievementsRes.data);
      setBadges(badgesRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const { user: profileUser, achievements: userAchievements, badges: userBadges } = gamificationData;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ToastContainer position="top-center" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      {/* Book Button do të vendoset pranë emrit */}
      {/* Header with Level & XP */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            {profileUser.Profile?.profilePicture ? (
              <img
                src={`https://192.168.100.57:5098${profileUser.Profile.profilePicture}`}
                alt={profileUser.firstName}
                className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white text-purple-600 flex items-center justify-center text-3xl font-bold border-4 border-white shadow-lg">
                {profileUser.firstName?.[0]}
              </div>
            )}
            <div className="flex-1 flex flex-col md:flex-row md:items-center md:gap-4">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">
                  {profileUser.firstName} {profileUser.lastName}
                </h1>
                <button
                  onClick={goToBook}
                  className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-full shadow font-bold transition text-base md:text-lg"
                  title="Open Achievements Book"
                >
                  <SparklesIcon className="h-5 w-5" />
                  Book
                </button>
              </div>
              <p className="text-purple-100 md:ml-2">
                {profileUser.Profile?.position} {profileUser.Profile?.club && `• ${profileUser.Profile.club}`}
              </p>
            </div>
          </div>

          {/* Level & XP Bar */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400 rounded-lg">
                  <TrophyIcon className="h-8 w-8 text-yellow-900" />
                </div>
                <div>
                  <p className="text-sm text-purple-100">Level</p>
                  <p className="text-4xl font-bold">{profileUser.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-purple-100">Total XP</p>
                <p className="text-2xl font-bold">{profileUser.experience.toLocaleString()}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress to Level {profileUser.level + 1}</span>
                <span>{profileUser.progressToNextLevel}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${profileUser.progressToNextLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <StarIcon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{profileUser.points.toLocaleString()}</p>
              <p className="text-sm text-purple-100">Points</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <TrophyIcon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">#{profileUser.rank}</p>
              <p className="text-sm text-purple-100">Rank</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <SparklesIcon className="h-6 w-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{userAchievements.length}</p>
              <p className="text-sm text-purple-100">Achievements</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <StarSolid className="h-6 w-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{userBadges.length}</p>
              <p className="text-sm text-purple-100">Badges</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6 overflow-x-auto">
            {['overview', 'achievements', 'badges', 'leaderboard'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium transition-colors capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity (Last 7 Days)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <FireIcon className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-900">
                      {profileUser.recentActivity?.posts ?? 0}
                    </p>
                    <p className="text-sm text-blue-700">Posts Created</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                  <StarIcon className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-900">
                      {profileUser.recentActivity?.likesReceived ?? 0}
                    </p>
                    <p className="text-sm text-red-700">Likes Received</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Achievements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userAchievements.slice(0, 6).map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-start gap-3 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
                  >
                    <div className="text-4xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{achievement.name}</h3>
                      <p className="text-sm text-gray-600">{achievement.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                          +{achievement.experience} XP
                        </span>
                        <span>
                          {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Badges */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Badges</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {userBadges.slice(0, 6).map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-4 bg-gradient-to-br ${getRarityColor(badge.rarity)} rounded-lg text-white text-center border-2 ${getRarityBorder(badge.rarity)} shadow-lg`}
                  >
                    <div className="text-4xl mb-2">{badge.icon}</div>
                    <p className="font-semibold text-sm">{badge.name}</p>
                    <p className="text-xs opacity-90 capitalize">{badge.rarity}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <SparklesIcon className="h-7 w-7 text-yellow-400" /> Achievements Book
            </h2>
            {/* Summary */}
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <span className="font-bold text-yellow-700">
                You have unlocked {achievements.filter(a => a.unlocked).length} out of {achievements.length} achievements!
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    achievement.unlocked
                      ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300 shadow'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`text-5xl ${!achievement.unlocked && 'grayscale opacity-50'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">
                            {achievement.name}
                          </h3>
                          <p className="text-sm text-gray-600">{achievement.description}</p>
                        </div>
                        {achievement.unlocked && (
                          <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        )}
                        {!achievement.unlocked && (
                          <LockClosedIcon className="h-6 w-6 text-gray-400" />
                        )}
                      </div>

                      {/* Progress Bar for Locked Achievements */}
                      {!achievement.unlocked && achievement.progress > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>
                              {achievement.current} / {achievement.required}
                            </span>
                            <span>{achievement.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${achievement.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-3">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                          +{achievement.experience} XP
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                          +{achievement.points} Points
                        </span>
                        {achievement.unlocked && (
                          <span className="text-xs text-gray-500">
                            {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Badge Collection</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`relative p-6 rounded-lg text-center border-2 transition-all ${
                    badge.earned
                      ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} text-white ${getRarityBorder(badge.rarity)} shadow-lg transform hover:scale-105`
                      : 'bg-gray-100 border-gray-200 opacity-50'
                  }`}
                >
                  {!badge.earned && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <LockClosedIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className={`text-5xl mb-2 ${!badge.earned && 'opacity-20'}`}>
                    {badge.icon}
                  </div>
                  <p className={`font-bold ${!badge.earned && 'text-gray-500'}`}>
                    {badge.name}
                  </p>
                  <p className={`text-xs mt-1 ${badge.earned ? 'opacity-90' : 'text-gray-500'}`}>
                    {badge.description}
                  </p>
                  <p className={`text-xs mt-2 font-medium capitalize ${!badge.earned && 'text-gray-500'}`}>
                    {badge.rarity}
                  </p>
                  {badge.earned && badge.earnedAt && (
                    <p className="text-xs mt-1 opacity-75">
                      {new Date(badge.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
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
                              src={`https://192.168.100.57:5098${player.Profile.profilePicture}`}
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
