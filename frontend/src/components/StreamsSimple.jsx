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
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/streams/live`);
        setStreams(res.data);
      } catch (err) {
        console.error('Error fetching streams:', err);
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
