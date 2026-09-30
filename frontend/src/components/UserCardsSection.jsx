
import React, { useEffect, useRef, useState } from 'react';
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
import VerifiedBadge from './VerifiedBadge';
import PersonName from './PersonName';

const AUTO_ADVANCE_MS = 3000;

const UserCardsSection = ({ role = 'athlete' }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState({}); // { [userId]: true/false }
  const [loadingFollow, setLoadingFollow] = useState({}); // { [userId]: true/false }
  const [onlineStatus, setOnlineStatus] = useState({}); // { [userId]: true/false }
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollerRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    profileAPI.getAllProfiles({ role, limit: role === 'club' ? 6 : 8 })
      .then(async res => {
        setProfiles(res.data);
        if (role === 'club') return;
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
  }, [user, role]);

  // Auto-advance one card left every 3s (Discover + Club network)
  useEffect(() => {
    if (profiles.length < 2) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tick = () => {
      if (pausedRef.current) return;
      const el = scrollerRef.current;
      if (!el) return;
      const card = el.querySelector('[data-user-card]');
      if (!card) return;
      const styles = window.getComputedStyle(el);
      const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12;
      const step = card.getBoundingClientRect().width + gap;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 4) return;

      const next = el.scrollLeft + step;
      if (next >= maxScroll - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    };

    const id = window.setInterval(tick, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [profiles.length, role]);

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

  if (loading) return <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label={role === 'club' ? 'Duke ngarkuar klubet' : 'Duke ngarkuar talentet'}>
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="xt-skeleton h-64 rounded-2xl sm:h-72" />)}
  </div>;
  if (!profiles.length) {
    return (
      <div className="xt-empty-state xt-card mb-6 py-8">
        <div className="text-sm text-[var(--xt-color-text-muted)]">{role === 'club' ? 'Nuk ka klube të veçuara për momentin.' : 'Nuk ka lojtarë për momentin.'}</div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 hide-scrollbar-mobile"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onFocusCapture={() => { pausedRef.current = true; }}
        onBlurCapture={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
      >
        {profiles.map(profile => (
          <div
            key={profile.id}
            data-user-card
            className="group relative h-72 min-w-[min(72vw,15rem)] snap-start overflow-hidden rounded-2xl border border-white/10 shadow-[var(--xt-shadow-card)] sm:h-80 sm:min-w-[17rem]"
          >
            <img
              src={profile.profilePhoto || profile.clubLogo ? getFullUrl(profile.profilePhoto || profile.clubLogo) : '/default-avatar.svg'}
              alt={profile.firstName + ' ' + profile.lastName}
              className={`object-cover w-full h-full transition-transform duration-500 group-hover:scale-105 ${onlineStatus[profile.id] === true ? 'ring-2 ring-green-500/70' : 'ring-2 ring-white/20'}`}
              loading="lazy"
              decoding="async"
              onError={e => { e.target.onerror = null; e.target.src = '/default-avatar.svg'; }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/45" />

            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/45 to-transparent">
              <div className="flex items-start gap-2 text-lg font-bold leading-tight text-white drop-shadow-lg sm:text-xl">
                <PersonName>
                  {profile.firstName} {profile.lastName}
                </PersonName>
                <VerifiedBadge verified={profile.verified} size="sm" tone="white" />
                {role === 'athlete' && onlineStatus[profile.id] === true ? (
                  <span title="Online" className="inline-block w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                ) : role === 'athlete' ? (
                  <span title="Offline" className="inline-block w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />
                ) : null}
              </div>
              <div className="mt-1 text-sm font-semibold text-white/85 drop-shadow">{role === 'club' ? (profile.clubName || profile.name || profile.league || 'Football club') : (profile.position || '—')}</div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/55 via-black/35 to-transparent">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-white/90 drop-shadow">
                {role === 'club' ? (
                  <>
                    {(profile.city || profile.Profile?.city) && (
                      <span className="xt-badge border-white/20 bg-black/35 text-white">
                        {profile.city || profile.Profile?.city}
                      </span>
                    )}
                    {(profile.country || profile.Profile?.country) && (
                      <span className="xt-badge border-white/20 bg-black/35 text-white">
                        {profile.country || profile.Profile?.country}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {getProfileAge(profile) != null && (
                      <span className="xt-badge border-white/20 bg-black/35 text-white">
                        {getProfileAge(profile)} vjeç
                      </span>
                    )}
                    {profile.country && (
                      <span className="xt-badge border-white/20 bg-black/35 text-white">{profile.country}</span>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2">
                <button
                  className="btn btn-primary min-h-11 flex-1 px-2 text-[10px] uppercase tracking-wide"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                >
                  SHIKO PROFILIN
                </button>
                {role === 'athlete' && user && user.id !== profile.id && (
                  <button
                    className={`min-h-11 flex-1 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-wide transition ${followStatus[profile.id] ? 'border-white/25 bg-black/45 text-white hover:bg-black/65' : 'border-white/25 bg-white/15 text-white hover:bg-white/25'}`}
                    onClick={() => handleFollow(profile.id)}
                    disabled={loadingFollow[profile.id]}
                  >
                    {loadingFollow[profile.id] ? '...' : followStatus[profile.id] ? 'NDJEKUR' : 'NDIQE'}
                  </button>
                )}
                {role === 'athlete' && (!user || user.id === profile.id) && (
                  <button className="min-h-11 flex-1 rounded-lg border border-white/25 bg-black/35 px-2 text-[10px] font-semibold uppercase tracking-wide text-white/70" disabled>
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
