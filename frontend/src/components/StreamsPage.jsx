import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
// import userStreamsAPI from '../services/userStreamsAPI';
import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function StreamsPage() {
  const { user } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStreams = async () => {
      if (!user) return;
      try {
        // Stream/livestream fetch removed
        setStreams([]);
      } catch (err) {
        setStreams([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStreams();
  }, [user]);

  const handleUpload = async () => {
    if (!videoFile) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', 'Recorded Stream');
      formData.append('description', 'Inqizim i ruajtur');
      await API.post('/streams/upload-recording', formData);
      setVideoFile(null);
      window.location.reload();
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">My Streams</h1>
      <div className="mb-8">
        <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} />
        <button onClick={handleUpload} disabled={uploading || !videoFile} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded">
          {uploading ? 'Uploading...' : 'Upload Recording'}
        </button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
      {loading ? (
        <div>Loading streams...</div>
      ) : !streams.length ? (
        <div>No live or recorded streams found.</div>
      ) : (
        <ul className="space-y-4">
          {streams.map(stream => (
            <li key={stream.id} className="border rounded p-4">
              <div className="font-bold">{stream.title}</div>
              <div>{stream.description}</div>
              <div>Status: {stream.isLive ? 'LIVE' : stream.videoUrl ? 'Recorded' : 'Offline'}</div>
              {stream.videoUrl && (
                <video src={`${import.meta.env.VITE_API_URL.replace('/api','')}${stream.videoUrl}`} controls className="w-full mt-2" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
