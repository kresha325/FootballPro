
import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
  const [onlineStatus, setOnlineStatus] = useState({}); // { [userId]: true/false }
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    profileAPI.getAllProfiles({ role: 'athlete', limit: 8 })
      .then(async res => {
        setProfiles(res.data);
        // Fetch follow status and online status for each profile
        const statusObj = {};
        const onlineObj = {};
        await Promise.all(res.data.map(async (profile) => {
          if (user && user.id !== profile.id) {
            try {
              const resp = await profileAPI.checkFollowStatus(profile.id);
              statusObj[profile.id] = resp.data.isFollowing;
            } catch {
              statusObj[profile.id] = false;
            }
          }
          // Fetch online status
          try {
            const onlineRes = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/users/${profile.id}/online`);
            onlineObj[profile.id] = onlineRes.data.online;
          } catch {
            onlineObj[profile.id] = false;
          }
        }));
        setFollowStatus(statusObj);
        setOnlineStatus(onlineObj);
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
          <div
            key={profile.id}
            className="relative min-w-[220px] h-[320px] rounded-2xl shadow-xl overflow-hidden snap-start group"
          >
            <img
              src={profile.profilePhoto ? getFullUrl(profile.profilePhoto) : '/default-avatar.svg'}
              alt={profile.firstName + ' ' + profile.lastName}
              className={`object-cover w-full h-full transition-transform duration-500 group-hover:scale-105 ${onlineStatus[profile.id] === true ? 'ring-2 ring-green-500/70' : 'ring-2 ring-white/20'}`}
              loading="lazy"
              decoding="async"
              onError={e => { e.target.src = '/default-avatar.svg'; }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/45" />

            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/45 to-transparent">
              <div className="text-3xl font-bold text-white drop-shadow-lg leading-tight flex items-center gap-2">
                {profile.firstName} {profile.lastName}
                {onlineStatus[profile.id] === true ? (
                  <span title="Online" className="inline-block w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                ) : (
                  <span title="Offline" className="inline-block w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />
                )}
              </div>
              <div className="text-white text-base font-semibold drop-shadow">{profile.position || '—'}</div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/55 via-black/35 to-transparent">
              <div className="mb-2 text-sm text-white/95 font-medium drop-shadow">
                Mosha: {getProfileAge(profile) ?? '—'} {profile.country ? `🌍 ${profile.country}` : ''}
              </div>
              <div className="flex gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2">
                <button
                  className="flex-1 bg-green-600/95 hover:bg-green-700 text-white font-semibold text-xs py-2 rounded-lg transition"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                >
                  SHIKO PROFILIN
                </button>
                {user && user.id !== profile.id && (
                  <button
                    className={`flex-1 font-semibold text-xs py-2 rounded-lg transition ${followStatus[profile.id] ? 'bg-gray-300/95 hover:bg-gray-400 text-gray-900' : 'bg-white/20 hover:bg-white/30 text-white border border-white/25'}`}
                    onClick={() => handleFollow(profile.id)}
                    disabled={loadingFollow[profile.id]}
                  >
                    {loadingFollow[profile.id] ? '...' : followStatus[profile.id] ? 'NDJEKUR' : 'NDIQE'}
                  </button>
                )}
                {(!user || user.id === profile.id) && (
                  <button className="flex-1 bg-white/20 text-white/80 font-semibold text-xs py-2 rounded-lg cursor-not-allowed border border-white/25" disabled>
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