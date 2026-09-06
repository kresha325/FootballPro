import React, { useEffect, useState } from 'react';
import { ligaAPI } from '../../services/api';
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
  };
}

const LigaProfile = ({ liga, profile, userId }) => {
  const [data, setData] = useState(liga || mapProfileToLiga(profile));
  const [loading, setLoading] = useState(!liga);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const uid = userId || profile?.userId || profile?.User?.id;

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
  }, [liga, profile, userId]);

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
  const clubs = Array.isArray(data.clubs) ? data.clubs : [];
  const competitions = Array.isArray(data.competitions) ? data.competitions : [];
  const contact =
    data.contact && typeof data.contact === 'object' && Object.keys(data.contact).length
      ? data.contact
      : null;
  const social =
    data.socialLinks && typeof data.socialLinks === 'object' ? Object.entries(data.socialLinks) : [];

  return (
    <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6">
      <div className="flex items-center mb-4">
        {logo ? (
          <img src={logo} alt={data.name || 'Liga'} className="w-20 h-20 rounded-full mr-4 object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full mr-4 bg-slate-200 flex items-center justify-center text-slate-500 text-xl font-bold">
            {String(data.name || 'L').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{data.name || 'Liga'}</h2>
          <p className="text-gray-600">
            {[data.country, data.level].filter(Boolean).join(' • ') || '—'}
          </p>
          {data.foundedYear ? <p className="text-gray-500">Founded: {data.foundedYear}</p> : null}
        </div>
      </div>
      {data.description ? (
        <p className="mb-4 whitespace-pre-wrap text-gray-800">{data.description}</p>
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
      {clubs.length > 0 ? (
        <div className="mb-4">
          <h3 className="font-semibold mb-1">Clubs</h3>
          <ul className="list-disc ml-6 text-sm text-gray-700">
            {clubs.map((club, idx) => (
              <li key={`${club}-${idx}`}>{typeof club === 'string' ? club : club?.name || JSON.stringify(club)}</li>
            ))}
          </ul>
        </div>
      ) : null}
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
