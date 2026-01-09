import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function StreamsSimple() {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState(null);
  const [newStream, setNewStream] = useState({
    title: '',
    description: '',
    isPremium: false,
  });

  useEffect(() => {
    fetchStreams();
    // Poll for live streams every 10 seconds
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreams = async () => {
    try {
      const response = await API.get('/streams');
      setStreams(response.data || []);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const createStream = async (e) => {
    e.preventDefault();
    try {
      const response = await API.post('/streams', newStream);
      setShowCreateModal(false);
      setNewStream({ title: '', description: '', isPremium: false });
      setSelectedStream(response.data);
      fetchStreams();
      alert('Stream created! Share your stream key with your streaming software.');
    } catch (error) {
      console.error('Error creating stream:', error);
      alert('Failed to create stream');
    }
  };

  const endStream = async (streamId) => {
    try {
      await API.put(`/streams/${streamId}/end`);
      setSelectedStream(null);
      fetchStreams();
    } catch (error) {
      console.error('Error ending stream:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const liveStreams = streams.filter(s => s.isLive);
  const pastStreams = streams.filter(s => !s.isLive);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Live Streams</h1>
          <p className="text-gray-600 dark:text-gray-400">Shiko dhe transmeto live</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-md flex items-center gap-2"
        >
          <span className="text-xl">🔴</span>
          Go Live
        </button>
      </div>

      {/* Live Streams */}
      {liveStreams.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="animate-pulse w-3 h-3 bg-red-600 rounded-full"></span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              LIVE NOW ({liveStreams.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveStreams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => setSelectedStream(stream)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Thumbnail */}
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

                {/* Info */}
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
      )}

      {/* Past Streams */}
      {pastStreams.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Transmetimet e Kaluara
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pastStreams.map((stream) => (
              <div
                key={stream.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="relative aspect-video bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
                  <span className="text-4xl opacity-50">📺</span>
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    Ended
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                    {stream.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {stream.User?.firstName} {stream.User?.lastName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {streams.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📺</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nuk ka streams</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Bëhu i pari që transmeton live!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
          >
            🔴 Go Live
          </button>
        </div>
      )}

      {/* Create Stream Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Start Live Stream</h2>
            
            <form onSubmit={createStream} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulli i Stream-it
                </label>
                <input
                  type="text"
                  value={newStream.title}
                  onChange={(e) => setNewStream({ ...newStream, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Training Session, Match Highlights..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Përshkrimi
                </label>
                <textarea
                  value={newStream.description}
                  onChange={(e) => setNewStream({ ...newStream, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Përshkruaj stream-in..."
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPremium"
                  checked={newStream.isPremium}
                  onChange={(e) => setNewStream({ ...newStream, isPremium: e.target.checked })}
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="isPremium" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  ⭐ Premium Stream (vetëm për subscribers)
                </label>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                  <strong>Hapi tjetër:</strong>
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Pas krijimit të stream-it, do të merrësh një Stream Key që duhet ta përdorësh në OBS ose software tjetër streaming.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Anulo
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  🔴 Go Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stream View Modal */}
      {selectedStream && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                {selectedStream.isLive && (
                  <span className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    <span className="animate-pulse w-2 h-2 bg-white rounded-full"></span>
                    LIVE
                  </span>
                )}
                <span className="text-white text-lg font-semibold">{selectedStream.title}</span>
              </div>
              <button
                onClick={() => setSelectedStream(null)}
                className="text-white hover:text-gray-300 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Video Player */}
            <div className="bg-black rounded-xl aspect-video flex items-center justify-center mb-4">
              <div className="text-center">
                <span className="text-8xl mb-4 block">📺</span>
                <p className="text-white text-xl mb-2">Live Stream Player</p>
                <p className="text-gray-400 text-sm">
                  {selectedStream.isLive 
                    ? `${selectedStream.viewers || 0} viewers watching`
                    : 'Stream has ended'}
                </p>
              </div>
            </div>

            {/* Stream Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
                    {selectedStream.User?.firstName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedStream.User?.firstName} {selectedStream.User?.lastName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedStream.isPremium ? '⭐ Premium Stream' : 'Free Stream'}
                    </p>
                  </div>
                </div>

                {selectedStream.streamerId === user?.id && selectedStream.isLive && (
                  <button
                    onClick={() => endStream(selectedStream.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    End Stream
                  </button>
                )}
              </div>

              {selectedStream.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {selectedStream.description}
                </p>
              )}

              {selectedStream.streamKey && selectedStream.streamerId === user?.id && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                    🔑 Your Stream Key:
                  </p>
                  <code className="block bg-white dark:bg-gray-900 px-3 py-2 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    {selectedStream.streamKey}
                  </code>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                    Use this key in your streaming software (OBS, Streamlabs, etc.)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
