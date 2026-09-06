import React from 'react';
import { getFullUrl } from '../../utils/mediaUrl';

const FederationProfile = ({ federation, profile }) => {
  const data = federation || profile;
  if (!data) {
    return (
      <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6 text-center text-gray-500">
        Nuk ka të dhëna federation. Plotëso profilin nga Edit Profile.
      </div>
    );
  }

  const photo = getFullUrl(data.profilePhoto || data.logo);
  const name = data.club || data.name || 'Federation';
  const contact =
    data.contact && typeof data.contact === 'object' && Object.keys(data.contact).length
      ? data.contact
      : null;
  const history = data.careerHistory;

  return (
    <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6">
      <div className="flex items-center mb-4">
        {photo ? (
          <img src={photo} alt={name} className="w-20 h-20 rounded-full mr-4 object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full mr-4 bg-slate-200 flex items-center justify-center text-slate-500 text-xl font-bold">
            {String(name).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{name}</h2>
          <p className="text-gray-600">
            {[data.city, data.country].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
      </div>
      {data.bio ? <p className="mb-4 whitespace-pre-wrap text-gray-800">{data.bio}</p> : null}
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
      {history ? (
        <div className="mb-4">
          <h3 className="font-semibold mb-1">History</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {typeof history === 'string' ? history : JSON.stringify(history, null, 2)}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default FederationProfile;
