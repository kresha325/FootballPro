import React from 'react';

const PlayerProfileHeader = ({ profile = {}, stats }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col md:flex-row items-center gap-6 mb-6">
      <div className="flex flex-col items-center md:items-start gap-2">
        <img
          src={profile.profilePhoto ? profile.profilePhoto : '/default-avatar.png'}
          alt={profile.firstName + ' ' + profile.lastName}
          className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg bg-gray-200"
        />
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile.firstName} {profile.lastName}</div>
        <div className="text-base text-gray-600 dark:text-gray-300 font-medium">{profile.position || '-'}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{profile.club ? profile.club : ''}{profile.city ? ', ' + profile.city : ''}{profile.country ? ', ' + profile.country : ''}</div>
        <div className="flex gap-4 mt-2">
          <span className="text-xs text-gray-500">{profile.followers} Followers</span>
          <span className="text-xs text-gray-500">{profile.following} Following</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfileHeader;
