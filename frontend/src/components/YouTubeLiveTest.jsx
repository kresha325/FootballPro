import React, { useMemo, useState } from 'react';
import { buildYoutubeChannelLiveEmbedUrl } from '../utils/youtubeLiveEmbed';

/** Kanal testi YouTube — transmetimi duhet nisur nga OBS/Studio në këtë kanal; shikuesi merr live-in aktual përmes embed. */
const DEFAULT_TEST_CHANNEL_ID = 'UCflsCrcGKQ85RYdNM5oW27w';

export default function YouTubeLiveTest() {
  const [mode, setMode] = useState('channel'); // 'channel' | 'video'
  const [videoId, setVideoId] = useState('');

  const testChannelId = (
    import.meta.env.VITE_YOUTUBE_TEST_CHANNEL_ID?.trim() || DEFAULT_TEST_CHANNEL_ID
  ).trim();

  const studioLiveUrl = useMemo(
    () => `https://studio.youtube.com/channel/${testChannelId}/livestreaming`,
    [testChannelId]
  );

  const embedUrl = useMemo(() => {
    if (mode === 'channel') {
      return buildYoutubeChannelLiveEmbedUrl(testChannelId);
    }
    if (videoId.trim()) {
      return `https://www.youtube.com/embed/${encodeURIComponent(videoId.trim())}?autoplay=1`;
    }
    return null;
  }, [mode, testChannelId, videoId]);

  return (
    <div className="max-w-3xl mx-auto p-4 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-3">YouTube Live — test</h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Lidhur me kanalin e testit (<code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{testChannelId}</code>
        ). Kur nisni live nga YouTube Studio / OBS në këtë kanal, player-i më poshtë duhet të shfaqë transmetimin (kur nuk ka
        live, YouTube tregon mesazh bosh / offline).
      </p>

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Burimi:</span>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="yt-mode"
            checked={mode === 'channel'}
            onChange={() => setMode('channel')}
          />
          Live i kanalit të testit
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="yt-mode"
            checked={mode === 'video'}
            onChange={() => setMode('video')}
          />
          Video / live ID manual (watch?v=…)
        </label>
      </div>

      {mode === 'video' ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            YouTube video ose stream ID
          </label>
          <input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-900"
            placeholder="p.sh. dQw4w9WgXcQ"
          />
        </div>
      ) : null}

      {embedUrl ? (
        <div className="aspect-video w-full bg-black rounded overflow-hidden">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title="YouTube Live"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">Zgjidh &quot;Live i kanalit&quot; ose vendos një ID video.</div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={studioLiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-semibold text-red-700 dark:text-red-400 hover:underline"
        >
          Hap YouTube Studio → Live (kanali i testit)
        </a>
        <a
          href={`https://www.youtube.com/channel/${testChannelId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Faqja e kanalit
        </a>
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/80 rounded border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold mb-2">OBS → YouTube (për testim)</h2>
        <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>
            <a href={studioLiveUrl} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noreferrer">
              YouTube Studio → Go Live
            </a>{' '}
            → kopjo Stream key (mos e ndaj publikisht).
          </li>
          <li>OBS: Settings → Stream → YouTube / Primary → ngjit stream key → Start Streaming.</li>
          <li>Në Studio: konfirmo preview, pastaj Start stream në YouTube.</li>
          <li>Rifresko këtë faqe — moduli &quot;Live i kanalit të testit&quot; duhet të luajë të njëjtin live.</li>
          <li className="list-none pl-0 mt-2 text-gray-600 dark:text-gray-400">
            Opsional: vendos <code className="text-xs">VITE_YOUTUBE_TEST_CHANNEL_ID</code> në <code className="text-xs">.env</code>{' '}
            për një kanal tjetër.
          </li>
        </ol>
      </div>
    </div>
  );
}
