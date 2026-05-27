import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { dedupeLiveByStreamer } from '../utils/liveStreams';
import { resolveStreamerPhotoUrl } from '../utils/avatarUrl';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const siteRoot = String(import.meta.env.VITE_API_URL || '')
  .replace(/\/api\/?$/i, '')
  .replace(/\/$/, '');

function streamAvatar(stream) {
  const s = stream?.streamer;
  if (!s) return null;
  if (s.photoUrl) return resolveStreamerPhotoUrl(s.photoUrl, siteRoot);
  return resolveStreamerPhotoUrl(s.Profile?.profilePhoto, siteRoot);
}

function recordingSrc(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return '';
  const v = videoUrl.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (!siteRoot) return v.startsWith('/') ? v : `/${v}`;
  return siteRoot + (v.startsWith('/') ? v : `/${v}`);
}

export default function StreamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [listSearch, setListSearch] = useState('');

  const filteredLive = useMemo(
    () =>
      filterBySearch(liveStreams, listSearch, (s) => [
        s.title,
        s.description,
        s.streamer?.firstName,
        s.streamer?.lastName,
      ]),
    [liveStreams, listSearch]
  );

  const recorded = useMemo(() => {
    const rec = streams.filter((s) => !s.isLive && s.videoUrl);
    return filterBySearch(rec, listSearch, (s) => [
      s.title,
      s.description,
      s.streamer?.firstName,
      s.streamer?.lastName,
    ]);
  }, [streams, listSearch]);

  useEffect(() => {
    const fetchStreams = async () => {
      if (!user) return;
      try {
        const res = await API.get('/streams', { params: { limit: 50 } });
        const all = Array.isArray(res.data) ? res.data : [];
        setStreams(all);
        setLiveStreams(dedupeLiveByStreamer(all.filter((s) => s.isLive)));
      } catch (err) {
        console.error('Streams fetch error:', err);
        setStreams([]);
        setLiveStreams([]);
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
      const res = await API.get('/streams', { params: { limit: 50 } });
      const all = Array.isArray(res.data) ? res.data : [];
      setStreams(all);
      setLiveStreams(all.filter((s) => s.isLive));
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-8 px-3 sm:px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Streams</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Live aktive hapen me të njëjtin player si në Feed (YouTube ose LiveKit). Ngarko regjistrime më poshtë.
      </p>

      <ListSearchBar
        value={listSearch}
        onChange={setListSearch}
        placeholder="Kërko stream sipas titullit ose streamer-it…"
      />

      {filteredLive.length > 0 ? (
        <section className="mb-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3">
          <h2 className="text-base font-extrabold text-red-800 dark:text-red-300 mb-3">Live Now</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {filteredLive.map((stream) => {
              const streamer = stream?.streamer || {};
              const name =
                `${streamer.firstName || ''} ${streamer.lastName || ''}`.trim() || stream?.title || 'Live';
              const photo = streamAvatar(stream);
              return (
                <button
                  key={stream.id}
                  type="button"
                  onClick={() => navigate(`/live/${stream.id}`)}
                  className="flex-shrink-0 flex flex-col items-center w-[96px] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg py-1"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover border-2 border-red-500 bg-gray-200 dark:bg-gray-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full border-2 border-red-500 bg-red-700 flex items-center justify-center text-white font-bold text-lg">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="mt-1.5 text-xs font-bold text-gray-900 dark:text-gray-100 text-center line-clamp-2 w-full">
                    {name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-extrabold text-red-600 dark:text-red-400">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Ngarko regjistrim</h2>
      <div className="mb-8">
        <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
        <button
          onClick={handleUpload}
          disabled={uploading || !videoFile}
          className="ml-2 px-4 py-2 bg-blue-600 text-white rounded"
        >
          {uploading ? 'Uploading...' : 'Upload Recording'}
        </button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>

      {loading ? (
        <div className="text-gray-600 dark:text-gray-400">Loading streams...</div>
      ) : !streams.length ? (
        <div className="text-gray-600 dark:text-gray-400">No streams found.</div>
      ) : (
        <ul className="space-y-4">
          {recorded.length === 0 && liveStreams.length === 0 ? (
            <li className="text-gray-600 dark:text-gray-400">No recorded videos yet.</li>
          ) : null}
          {recorded.map((stream) => (
            <li key={stream.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <div className="font-bold text-gray-900 dark:text-white">{stream.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stream.description}</div>
              <div className="text-xs text-gray-500 mt-1">Recorded</div>
              {stream.videoUrl && (
                <video src={recordingSrc(stream.videoUrl)} controls className="w-full mt-2 rounded" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
