import React, { useEffect, useMemo, useState } from 'react';
import { ligaAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getFullUrl } from '../../utils/mediaUrl';

function mapProfileToLiga(profile) {
  if (!profile) return null;
  return {
    name: profile.name || profile.club || 'Liga',
    logo: profile.logo || profile.profilePhoto,
    country: profile.country,
    level: profile.level,
    foundedYear: profile.foundedYear,
    description: profile.description || profile.bio,
    website: profile.website,
    clubs: profile.clubs || [],
    competitions: profile.competitions || [],
    contact: profile.contact || {},
    socialLinks: profile.socialLinks || {},
    userId: profile.userId || profile.User?.id,
  };
}

function clubIdOf(entry) {
  if (entry == null) return null;
  if (typeof entry === 'number' || typeof entry === 'string') return String(entry);
  return String(entry.id || entry.userId || entry.clubId || '');
}

const LigaProfile = ({ liga, profile, userId, isOwner, onEdit }) => {
  const { user } = useAuth();
  const [data, setData] = useState(liga || mapProfileToLiga(profile));
  const [loading, setLoading] = useState(!liga);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const ligaUserId = userId || data?.userId || data?.User?.id || profile?.userId || profile?.User?.id;

  const refresh = async () => {
    if (!ligaUserId) return;
    const res = await ligaAPI.getLiga(ligaUserId);
    setData(res.data);
  };

  useEffect(() => {
    let cancelled = false;
    const uid = ligaUserId;

    if (liga) {
      setData(liga);
      setLoading(false);
      return undefined;
    }

    if (!uid) {
      setData(mapProfileToLiga(profile));
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    ligaAPI
      .getLiga(uid)
      .then((res) => {
        if (cancelled) return;
        setData(res.data || mapProfileToLiga(profile));
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = mapProfileToLiga(profile);
        setData(fallback);
        if (!fallback?.name && !fallback?.description) {
          setError('Nuk ka të dhëna liga. Plotëso profilin nga Edit Profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [liga, profile, userId, ligaUserId]);

  const clubs = useMemo(() => (Array.isArray(data?.clubs) ? data.clubs : []), [data]);
  const isClubMember = useMemo(() => {
    if (!user?.id || user.role !== 'club') return false;
    return clubs.some((c) => clubIdOf(c) === String(user.id));
  }, [clubs, user]);

  const handleJoin = async () => {
    if (!ligaUserId) return;
    setActionLoading(true);
    try {
      const res = await ligaAPI.joinLiga(ligaUserId);
      setData(res.data.liga || res.data);
      alert(res.data.msg || 'U bashkuat në ligë.');
    } catch (e) {
      alert(e.response?.data?.msg || 'Nuk u bashkuat dot në ligë.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!ligaUserId) return;
    if (!window.confirm('Doni të largoheni nga kjo ligë?')) return;
    setActionLoading(true);
    try {
      const res = await ligaAPI.leaveLiga(ligaUserId);
      setData(res.data.liga || res.data);
      alert(res.data.msg || 'U larguat nga liga.');
    } catch (e) {
      alert(e.response?.data?.msg || 'Nuk u larguat dot.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveClub = async (clubId) => {
    if (!window.confirm('Heq këtë klub nga liga?')) return;
    setActionLoading(true);
    try {
      const res = await ligaAPI.removeClub(clubId);
      setData(res.data.liga || res.data);
    } catch (e) {
      alert(e.response?.data?.msg || 'Nuk u hoq klubi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLiga = async () => {
    if (!window.confirm('Fshi ligën dhe turnetë e lidhura? Ky veprim nuk kthehet.')) return;
    setActionLoading(true);
    try {
      await ligaAPI.deleteLiga();
      alert('Liga u fshi.');
      window.location.href = '/';
    } catch (e) {
      alert(e.response?.data?.msg || 'Nuk u fshi liga.');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6 text-center text-gray-500 text-sm">
        Duke ngarkuar liga…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6 text-center text-gray-500">
        {error || 'Nuk ka të dhëna liga. Plotëso profilin nga Edit Profile.'}
      </div>
    );
  }

  const logo = getFullUrl(data.logo || data.profilePhoto);
  const competitions = Array.isArray(data.competitions) ? data.competitions : [];
  const contact =
    data.contact && typeof data.contact === 'object' && Object.keys(data.contact).length
      ? data.contact
      : null;
  const social =
    data.socialLinks && typeof data.socialLinks === 'object' ? Object.entries(data.socialLinks) : [];

  return (
    <div className="w-full max-w-2xl mx-auto bg-white shadow rounded p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {logo ? (
            <img src={logo} alt={data.name || 'Liga'} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xl font-bold shrink-0">
              {String(data.name || 'L').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold break-words">{data.name || 'Liga'}</h2>
            <p className="text-gray-600 text-sm sm:text-base">
              {[data.country, data.level].filter(Boolean).join(' • ') || '—'}
            </p>
            {data.foundedYear ? <p className="text-gray-500 text-sm">Founded: {data.foundedYear}</p> : null}
          </div>
        </div>

        <div className="flex flex-row flex-wrap gap-2 sm:flex-col w-full sm:w-auto shrink-0">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => onEdit?.()}
                className="flex-1 sm:flex-none min-h-10 px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-center"
              >
                Edito
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteLiga}
                className="flex-1 sm:flex-none min-h-10 px-3 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Fshi ligën
              </button>
            </>
          )}
          {user?.role === 'club' && !isOwner && (
            isClubMember ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleLeave}
                className="flex-1 sm:flex-none min-h-10 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Largohu
              </button>
            ) : (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleJoin}
                className="flex-1 sm:flex-none min-h-10 px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Bashkohu
              </button>
            )
          )}
        </div>
      </div>

      {user?.role === 'club' && isClubMember && (
        <p className="mb-4 text-xs sm:text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          Klubi juaj është anëtar i kësaj lige. Lojtarët e aprovuar sinkronizohen në turneun e ligës.
        </p>
      )}

      {data.description ? (
        <p className="mb-4 whitespace-pre-wrap break-words text-gray-800">{data.description}</p>
      ) : null}
      {data.website ? (
        <a
          href={data.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline mb-4 block"
        >
          Website
        </a>
      ) : null}
      <div className="mb-4">
        <h3 className="font-semibold mb-1">Clubs ({clubs.length})</h3>
        {clubs.length === 0 ? (
          <p className="text-sm text-gray-500">Nuk ka klube të bashkuara ende.</p>
        ) : (
          <ul className="space-y-2">
            {clubs.map((club, idx) => {
              const cid = clubIdOf(club);
              const label =
                typeof club === 'string' || typeof club === 'number'
                  ? `Klub #${club}`
                  : club?.name || `Klub #${cid}`;
              return (
                <li
                  key={`${cid}-${idx}`}
                  className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {isOwner && cid ? (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleRemoveClub(cid)}
                      className="shrink-0 text-red-600 hover:underline text-xs font-semibold"
                    >
                      Hiq
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {competitions.length > 0 ? (
        <div className="mb-4">
          <h3 className="font-semibold mb-1">Competitions</h3>
          <ul className="list-disc ml-6 text-sm text-gray-700">
            {competitions.map((comp, idx) => (
              <li key={`${comp}-${idx}`}>
                {typeof comp === 'string' ? comp : comp?.name || JSON.stringify(comp)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {contact ? (
        <div className="mb-4">
          <h3 className="font-semibold mb-1">Contact</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            {Object.entries(contact).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium capitalize">{k}: </span>
                {String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {social.length > 0 ? (
        <div>
          <h3 className="font-semibold mb-1">Social Links</h3>
          <ul className="flex flex-wrap gap-3">
            {social.map(([platform, url]) =>
              url ? (
                <li key={platform}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline capitalize">
                    {platform}
                  </a>
                </li>
              ) : null
            )}
          </ul>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-xs text-amber-700">{error}</p> : null}
    </div>
  );
};

export default LigaProfile;
