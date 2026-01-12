import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LiveBroadcast from './LiveBroadcast';
import LiveViewer from './LiveViewer';
import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function StreamsMediaSoup({ streams }) {
  const { user } = useAuth();
  const [selectedStream, setSelectedStream] = useState(null);
  const [mode, setMode] = useState(''); // 'broadcast' ose 'view'

  // Nis transmetim të ri
  const handleGoLive = () => {
    setMode('broadcast');
    setSelectedStream(null);
  };

  // Shiko një stream ekzistues
  const handleView = (stream) => {
    setSelectedStream(stream);
    setMode('view');
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Live Streams (MediaSoup)</h1>
        <button
          onClick={handleGoLive}
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-md flex items-center gap-2"
        >
          <span className="text-xl">🔴</span>
          Go Live
        </button>
      </div>
      {mode === 'broadcast' && (
        <div className="mb-8">
          <LiveBroadcast streamId={user && user.id} />
        </div>
      )}
      {mode === 'view' && selectedStream && (
        <div className="mb-8">
          <LiveViewer streamId={selectedStream.id} />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {streams.map((stream) => (
          <div
            key={stream.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={() => handleView(stream)}
          >
            <div className="relative aspect-video bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                <span className="animate-pulse w-2 h-2 bg-white rounded-full"></span>
                LIVE
              </div>
              <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                👁️ {stream.viewers || 0}
              </div>
              <span className="text-6xl">📺</span>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                {stream.title}
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  {stream.User?.firstName?.[0]}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stream.User?.firstName} {stream.User?.lastName}
                </span>
              </div>
              {stream.isPremium && (
                <span className="inline-block px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded text-xs font-semibold">
                  ⭐ PREMIUM
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
