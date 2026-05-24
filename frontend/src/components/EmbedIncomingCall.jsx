import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import VideoCallSimple from './VideoCallSimple';

const STORAGE_KEY = 'fp_embed_incoming_call';

function readIncomingPayload() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * WebView nga mobile: pranon thirrje hyrëse (offer + callId në sessionStorage).
 */
export default function EmbedIncomingCall() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = readIncomingPayload();
    if (!data?.from || (!data?.offer && !data?.callId)) {
      setError('Nuk u gjet thirrja hyrëse. Hap nga aplikacioni mobil pas Prano.');
      return;
    }

    const normalized = {
      from: data.from,
      callerName: data.callerName || '',
      offer: data.offer,
      callId: data.callId,
      audioOnly: !!data.audioOnly,
    };
    setIncoming(normalized);

    try {
      const { data: profile } = await api.get(`/profiles/${data.from}`);
      setTargetUser({
        id: profile.id ?? profile.userId ?? data.from,
        firstName: profile.firstName || data.callerName?.split?.(' ')?.[0] || '',
        lastName: profile.lastName || '',
        profilePhoto: profile.profilePhoto,
      });
    } catch (e) {
      setTargetUser({
        id: data.from,
        firstName: data.callerName?.split?.(' ')?.[0] || 'Caller',
        lastName: data.callerName?.split?.(' ')?.slice(1)?.join(' ') || '',
      });
    }
  }, []);

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

  if (!incoming || !targetUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Duke lidhur thirrjen…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <VideoCallSimple
        targetUser={targetUser}
        audioOnly={incoming.audioOnly}
        onClose={handleClose}
        initialCallId={incoming.callId}
        initialIncomingCall={incoming}
      />
    </div>
  );
}
