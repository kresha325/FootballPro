import React from 'react';

const LigaProfile = ({ liga }) => {
  if (!liga) return <div>No Liga data available.</div>;
  // Helper to check if url is absolute
  const isAbsoluteUrl = url => /^https?:\/\//.test(url);
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
  return (
    <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6">
      {/* Profile Photo */}
      <div className="flex justify-center mb-6">
          {/* Profile photo removed from overview as per requirements */}
      </div>
      <div className="flex items-center mb-4">
        {liga.logo && (
          <img
            src={isAbsoluteUrl(liga.logo) ? liga.logo : `${apiRoot}${liga.logo}`}
            alt="Liga Logo"
            className="w-20 h-20 rounded-full mr-4"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold">{liga.name}</h2>
          <p className="text-gray-600">{liga.country} • {liga.level}</p>
          <p className="text-gray-500">Founded: {liga.foundedYear}</p>
        </div>
      </div>
      <p className="mb-4">{liga.description}</p>
      {liga.website && (
        <a href={liga.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mb-4 block">Website</a>
      )}
      <div className="mb-4">
        <h3 className="font-semibold">Clubs</h3>
        <ul className="list-disc ml-6">
          {Array.isArray(liga.clubs) && liga.clubs.map((club, idx) => (
            <li key={idx}>{club}</li>
          ))}
        </ul>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Competitions</h3>
        <ul className="list-disc ml-6">
          {Array.isArray(liga.competitions) && liga.competitions.map((comp, idx) => (
            <li key={idx}>{comp}</li>
          ))}
        </ul>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Contact</h3>
        <pre className="bg-gray-100 p-2 rounded text-sm">{JSON.stringify(liga.contact, null, 2)}</pre>
      </div>
      <div>
        <h3 className="font-semibold">Social Links</h3>
        <ul className="flex gap-2">
          {liga.socialLinks && Object.entries(liga.socialLinks).map(([platform, url]) => (
            <li key={platform}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{platform}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LigaProfile;
