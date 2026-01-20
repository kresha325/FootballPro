import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import userStreamsAPI from '../services/userStreamsAPI';
import { API } from '../services/api';

// ...existing code...

export default function StreamsSimple() {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreams = async () => {
      if (!user) return;
      try {
        const userStreams = await userStreamsAPI.getUserStreams(user.id);
        setStreams(userStreams);
      } catch (err) {
        console.error('Error fetching user streams:', err);
        setStreams([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStreams();
  }, []);

  if (loading) {
    return <div className="text-center py-10">Loading live streams...</div>;
  }

  if (!streams.length) {
    return <div className="text-center py-10">No live streams at the moment.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Live Streams</h1>
      <StreamsMediaSoup streams={streams} />
    </div>
  );
}
