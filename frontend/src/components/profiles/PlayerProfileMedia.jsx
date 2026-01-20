import React from 'react';

const PlayerProfileMedia = ({ media }) => {
  const videos = Array.isArray(media) ? media.filter(item => item.type === 'video') : [];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Videos</h3>
      {videos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {videos.map((item, idx) => (
            <div key={idx} className="rounded-lg overflow-hidden shadow">
              <video src={item.imageUrl} controls className="w-full h-48 object-cover" />
              <div className="p-2 text-sm text-gray-700 dark:text-gray-300">{item.title || 'Video'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No videos found.</div>
      )}
    </div>
  );
};

export default PlayerProfileMedia;
