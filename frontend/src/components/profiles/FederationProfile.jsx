import React from 'react';

const FederationProfile = ({ federation }) => {
  if (!federation) return <div>No Federation data available.</div>;
  const isAbsoluteUrl = url => /^https?:\/\//.test(url);
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
  return (
    <div className="max-w-2xl mx-auto bg-white shadow rounded p-6 mt-6">
      {/* Profile Photo */}
      <div className="flex justify-center mb-6">
          {/* Profile photo removed from overview as per requirements */}
      </div>
      <div className="flex items-center mb-4">
        {federation.profilePhoto && (
          <img src={federation.profilePhoto} alt="Federation Logo" className="w-20 h-20 rounded-full mr-4" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{federation.club}</h2>
          <p className="text-gray-600">{federation.country}</p>
        </div>
      </div>
      <p className="mb-4">{federation.bio}</p>
      <div className="mb-4">
        <h3 className="font-semibold">Contact</h3>
        <pre className="bg-gray-100 p-2 rounded text-sm">{JSON.stringify(federation.contact, null, 2)}</pre>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Career History</h3>
        <pre className="bg-gray-100 p-2 rounded text-sm">{JSON.stringify(federation.careerHistory, null, 2)}</pre>
      </div>
    </div>
  );
};

export default FederationProfile;
