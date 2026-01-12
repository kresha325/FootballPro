import React, { useState } from 'react';
import LiveBroadcast from './LiveBroadcast';
import LiveViewer from './LiveViewer';
import { useAuth } from '../contexts/AuthContext';

// DEMO: Përdor streamId (mund të jetë id i stream-it ose userId i broadcaster-it)
export default function LiveStreamDemo() {
  const [streamId, setStreamId] = useState('');
  const [showViewer, setShowViewer] = useState(false);
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Demo Live Streaming (MediaSoup)</h1>
      <div className="mb-10">
        <LiveBroadcast streamId={user && user.id} />
      </div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold">Stream ID për të parë stream-in:</label>
        <input
          type="text"
          value={streamId}
          onChange={e => setStreamId(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-2"
          placeholder="Vendos streamId (p.sh. userId i broadcaster-it ose id i stream-it)"
        />
        <button
          onClick={() => setShowViewer(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded font-semibold"
        >
          Shiko Live
        </button>
      </div>
      {showViewer && streamId && <LiveViewer streamId={streamId} />}
    </div>
  );
}