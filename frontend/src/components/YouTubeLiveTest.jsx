import React, { useState } from 'react';

export default function YouTubeLiveTest() {
  const [videoId, setVideoId] = useState('');

  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-3">YouTube Live - Test</h1>
      <p className="mb-4 text-sm text-gray-600">Përdor këtë faqe për të parë një transmetim YouTube Live gjatë testimit. Hapi i parë: nisni një transmetim nga OBS në kanalin tuaj YouTube dhe kopjoni ID-në e stream (p.sh. fjalë pas watch?v=...).</p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Vendosni YouTube video/stream ID (p.sh. dQw4w9WgXcQ)</label>
        <input value={videoId} onChange={(e) => setVideoId(e.target.value)} className="w-full border rounded p-2" placeholder="YouTube live ID" />
      </div>

      {embedUrl ? (
        <div className="aspect-video w-full bg-black rounded overflow-hidden">
          <iframe className="w-full h-full" src={embedUrl} title="YouTube Live" frameBorder="0" allow="autoplay; encrypted-media"></iframe>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Shtyp ID të vlefshëm për të parë player-in këtu.</div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h2 className="font-semibold mb-2">Udhëzime të shkurtëra për OBS → YouTube</h2>
        <ol className="list-decimal list-inside text-sm">
          <li>Hyni në YouTube Studio → Create → Go Live → Copy Stream Key.</li>
          <li>Në OBS: Settings → Stream → Service: YouTube / Server: Primary → Vendosni Stream Key.</li>
          <li>Shto burim video (Camera) dhe Audio → Start Streaming në OBS.</li>
          <li>Kthehuni në YouTube Studio dhe prisni që preview/stream të konfirmohet, pastaj Start Stream në YouTube.</li>
          <li>Merrni ID-në e Live URL (pas watch?v=) dhe pastaj vendoseni në fushë për ta parë këtu.</li>
        </ol>
      </div>
    </div>
  );
}
