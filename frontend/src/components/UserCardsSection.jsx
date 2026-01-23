
import React, { useEffect, useState } from 'react';
// Helper për URL absolute/relative të fotos
const apiRoot = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api','') : '';
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
import { profileAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


const UserCardsSection = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState({}); // { [userId]: true/false }
  const [loadingFollow, setLoadingFollow] = useState({}); // { [userId]: true/false }
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    profileAPI.getAllProfiles({ role: 'athlete', limit: 8 })
      .then(async res => {
        setProfiles(res.data);
        // Fetch follow status for each profile
        const statusObj = {};
        await Promise.all(res.data.map(async (profile) => {
          if (user && user.id !== profile.id) {
            try {
              const resp = await profileAPI.checkFollowStatus(profile.id);
              statusObj[profile.id] = resp.data.isFollowing;
            } catch {
              statusObj[profile.id] = false;
            }
          }
        }));
        setFollowStatus(statusObj);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleFollow = async (profileId) => {
    setLoadingFollow(lf => ({ ...lf, [profileId]: true }));
    try {
      if (followStatus[profileId]) {
        await profileAPI.unfollowUser(profileId);
        setFollowStatus(fs => ({ ...fs, [profileId]: false }));
      } else {
        await profileAPI.followUser(profileId);
        setFollowStatus(fs => ({ ...fs, [profileId]: true }));
      }
    } catch {}
    setLoadingFollow(lf => ({ ...lf, [profileId]: false }));
  };

  const getAgeFromDate = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  };

  const getProfileAge = (profile) => {
    if (typeof profile?.age === 'number') return profile.age;
    if (typeof profile?.Profile?.age === 'number') return profile.Profile.age;
    return getAgeFromDate(profile?.dateOfBirth || profile?.User?.dateOfBirth);
  };

  if (loading) return <div className="mb-6">Loading players...</div>;
  if (!profiles.length) {
    return (
      <div className="mb-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">Nuk ka lojtarë për momentin.</div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory flex-nowrap hide-scrollbar-mobile">
        {profiles.map(profile => (
          <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden relative flex flex-col min-w-[220px] snap-start">
            <div className="relative h-48 w-full overflow-hidden">
              <img
                src={profile.profilePhoto ? getFullUrl(profile.profilePhoto) : '/default-avatar.png'}
                alt={profile.firstName + ' ' + profile.lastName}
                className="object-cover w-full h-full"
                loading="lazy"
                decoding="async"
                onError={e => { e.target.src = '/default-avatar.png'; }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="text-xl font-bold text-white drop-shadow-lg">{profile.firstName} {profile.lastName}</div>
                <div className="text-white text-sm font-medium drop-shadow">{profile.position || '—'}</div>
              </div>
            </div>
              <div className="flex-1 flex flex-col justify-between p-4 bg-gray-900/90 text-white">
              <div className="mb-2">
                <div className="text-sm opacity-80">Datëlindja: {getProfileAge(profile) ?? '—'} {profile.country ? `🌍 ${profile.country}` : ''}</div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium text-xs py-2 rounded-md transition"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                >
                  SHIKO PROFILIN
                </button>
                {user && user.id !== profile.id && (
                  <button
                    className={`flex-1 font-medium text-xs py-2 rounded-md transition ${followStatus[profile.id] ? 'bg-gray-400 hover:bg-gray-500' : 'bg-gray-700 hover:bg-gray-800'} text-white`}
                    onClick={() => handleFollow(profile.id)}
                    disabled={loadingFollow[profile.id]}
                  >
                    {loadingFollow[profile.id] ? '...' : followStatus[profile.id] ? 'NDJEKUR' : 'NDIQE'}
                  </button>
                )}
                {(!user || user.id === profile.id) && (
                  <button className="flex-1 bg-gray-300 text-gray-600 font-medium text-xs py-2 rounded-md cursor-not-allowed" disabled>
                    NDIQE
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserCardsSection;