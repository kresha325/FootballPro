import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import VideoCallSimple from './VideoCallSimple';

/**
 * Faqe minimale për WebView nga aplikacioni mobil: thirrje dalëse me të njëjtën logjikë si në web.
 * Query: targetUserId (numër), audioOnly (1 ose 0)
 */
export default function EmbedOutboundCall() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const targetUserId = parseInt(params.get('targetUserId'), 10);
  const audioOnly = params.get('audioOnly') === '1' || params.get('audioOnly') === 'true';
  const [targetUser, setTargetUser] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!targetUserId || Number.isNaN(targetUserId)) {
      setError('Parametri targetUserId mungon ose është i pavlefshëm.');
      return;
    }
    setError('');
    try {
      const { data } = await api.get(`/profiles/${targetUserId}`);
      setTargetUser({
        id: data.id ?? data.userId ?? targetUserId,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        profilePhoto: data.profilePhoto,
      });
    } catch (e) {
      setError(e?.response?.data?.msg || e.message || 'Nuk u ngarkua profili.');
    }
  }, [targetUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/feed');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <p className="text-center text-red-300 mb-6">{error}</p>
        <button type="button" className="px-4 py-2 rounded-lg bg-gray-700" onClick={handleClose}>
          Mbyll
        </button>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Duke përgatitur thirrjen…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <VideoCallSimple targetUser={targetUser} audioOnly={audioOnly} onClose={handleClose} />
    </div>
  );
}
