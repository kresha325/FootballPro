import { useState, useEffect, useMemo } from 'react';
import { adsAPI } from '../services/api';

const EUR_PER_UNIT = 1;
const SECONDS_PER_UNIT = 3;

/** €1 per 3s of media, charged per campaign day. Video 12s → €4/day. */
function pricePerDayFromSeconds(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return EUR_PER_UNIT;
  return Math.max(1, Math.ceil(n / SECONDS_PER_UNIT)) * EUR_PER_UNIT;
}

function mediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('blob:') || /^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) {
    return `${String(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')}${url}`;
  }
  return url;
}

export default function AdSlider() {
  const [ads, setAds] = useState([]);
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    text: '',
    color: '#34d399',
    image: null,
    imageUrl: '',
    mediaKind: null,
    mediaDurationSec: null,
    days: 1,
  });
  const [error, setError] = useState('');

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  useEffect(() => {
    adsAPI.getAds().then((res) => {
      if (res.data && res.data.length > 0) {
        const shuffled = shuffle(res.data);
        setAds(shuffled);
        setActive(Math.floor(Math.random() * shuffled.length));
      } else {
        setAds([]);
      }
    });
  }, []);

  // Per-ad display: video length, or 3s for images
  useEffect(() => {
    if (isPaused || ads.length === 0) return undefined;
    const current = ads[active] || ads[0];
    const sec = Math.max(3, Number(current?.displaySeconds) || 3);
    const id = setTimeout(() => {
      setActive((prev) => (prev + 1) % ads.length);
    }, sec * 1000);
    return () => clearTimeout(id);
  }, [isPaused, ads, active]);

  useEffect(() => {
    function handleAddAd(e) {
      if (e.detail && e.detail.ad) {
        setAds((prev) => [...prev, e.detail.ad]);
      }
    }
    function handleOpenModal() {
      setShowModal(true);
    }
    window.addEventListener('add-ad', handleAddAd);
    window.addEventListener('open-ad-modal', handleOpenModal);
    return () => {
      window.removeEventListener('add-ad', handleAddAd);
      window.removeEventListener('open-ad-modal', handleOpenModal);
    };
  }, []);

  const pricing = useMemo(() => {
    const d = Math.max(1, parseInt(String(form.days || '1'), 10) || 1);
    const perDay =
      form.mediaKind === 'video' && form.mediaDurationSec
        ? pricePerDayFromSeconds(form.mediaDurationSec)
        : EUR_PER_UNIT;
    const displaySeconds =
      form.mediaKind === 'video' && form.mediaDurationSec
        ? form.mediaDurationSec
        : SECONDS_PER_UNIT;
    return {
      days: d,
      pricePerDay: perDay,
      displaySeconds,
      priceEur: perDay * d,
    };
  }, [form.days, form.mediaKind, form.mediaDurationSec]);

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = String(file.type || '').startsWith('video/');
    const url = URL.createObjectURL(file);

    if (isVideo) {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.onloadedmetadata = () => {
        const sec = Math.max(1, Math.round(videoEl.duration || 1));
        URL.revokeObjectURL(videoEl.src);
        setForm((f) => ({
          ...f,
          image: file,
          imageUrl: url,
          mediaKind: 'video',
          mediaDurationSec: sec,
        }));
      };
      videoEl.src = url;
      return;
    }

    setForm((f) => ({
      ...f,
      image: file,
      imageUrl: url,
      mediaKind: 'image',
      mediaDurationSec: null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.text || !form.days || Number.isNaN(Number(form.days)) || Number(form.days) < 1) {
      setError('Plotëso të gjitha fushat dhe cakto ditët (1+).');
      return;
    }
    const data = new FormData();
    data.append('title', form.title);
    data.append('text', form.text);
    data.append('color', form.color);
    data.append('days', String(pricing.days));
    if (form.mediaDurationSec) data.append('mediaDurationSec', String(form.mediaDurationSec));
    if (form.image) {
      if (form.mediaKind === 'video') data.append('video', form.image);
      else data.append('image', form.image);
    }
    try {
      await adsAPI.createAd(data);
      const res = await adsAPI.getAds();
      setAds(res.data);
      setForm({
        title: '',
        text: '',
        color: '#34d399',
        image: null,
        imageUrl: '',
        mediaKind: null,
        mediaDurationSec: null,
        days: 1,
      });
      setShowModal(false);
    } catch (_err) {
      setError('Nuk u shtua reklama. Provo sërish.');
    }
  };

  const current = ads[active];

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-100 p-4 text-center dark:border-gray-600 dark:bg-gray-700">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <form
            onSubmit={handleSubmit}
            className="w-80 space-y-3 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
          >
            <h2 className="mb-2 text-lg font-bold">Shto reklamë</h2>
            <input
              type="text"
              className="w-full rounded border p-2"
              placeholder="Titulli"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <input
              type="text"
              className="w-full rounded border p-2"
              placeholder="Teksti"
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            />
            <input
              type="color"
              className="h-8 w-8"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
            <div className="relative w-full">
              <input
                type="number"
                min="1"
                className="w-full rounded border p-2 pr-12"
                placeholder="Numri i ditëve"
                value={form.days}
                onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                Ditë
              </span>
            </div>
            <p className="text-left text-xs text-gray-500">
              €{EUR_PER_UNIT}/ditë = {SECONDS_PER_UNIT}s media. Video 12s → €4/ditë. Total = çmimi ditor ×
              ditët.
            </p>
            <p className="text-left text-sm font-semibold text-[var(--xt-color-gold,#9A6B12)]">
              {form.mediaKind === 'video' && form.mediaDurationSec
                ? `Video ${form.mediaDurationSec}s → €${pricing.pricePerDay}/ditë × ${pricing.days} ditë = €${pricing.priceEur}`
                : `€${pricing.pricePerDay}/ditë × ${pricing.days} ditë = €${pricing.priceEur}`}
            </p>
            <input type="file" accept="image/*,video/*" onChange={handleMediaChange} className="w-full" />
            {form.imageUrl && form.mediaKind === 'video' ? (
              <video src={form.imageUrl} className="mt-2 h-32 w-full rounded object-cover" controls muted />
            ) : null}
            {form.imageUrl && form.mediaKind !== 'video' ? (
              <img src={form.imageUrl} alt="Preview" className="mt-2 h-32 w-full rounded object-cover" />
            ) : null}
            {error ? <div className="mb-2 text-sm text-red-500">{error}</div> : null}
            <div className="mt-2 flex gap-2">
              <button type="submit" className="flex-1 rounded bg-green-500 p-2 text-white">
                Shto · €{pricing.priceEur}
              </button>
              <button
                type="button"
                className="flex-1 rounded bg-gray-300 p-2 dark:bg-gray-600"
                onClick={() => setShowModal(false)}
              >
                Anulo
              </button>
            </div>
          </form>
        </div>
      )}
      {ads.length > 0 && current ? (
        <>
          <div
            style={{ background: current.color }}
            className="mb-2 cursor-pointer overflow-hidden rounded-lg p-0"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {current.videoUrl ? (
              <div className="flex h-56 w-full items-center justify-center bg-white dark:bg-gray-800">
                <video
                  src={mediaUrl(current.videoUrl)}
                  className="block h-full max-h-full w-full max-w-full object-contain"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            ) : current.imageUrl ? (
              <div className="flex h-56 w-full items-center justify-center bg-white dark:bg-gray-800">
                <img
                  src={mediaUrl(current.imageUrl)}
                  alt="Ad"
                  className="block h-full max-h-full w-full max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>
          <div className="mb-1 text-lg font-bold text-gray-900 dark:text-white">{current.title}</div>
          <div className="mb-2 text-gray-800 dark:text-gray-200">{current.text}</div>
          <div className="text-xs text-gray-500">
            {Math.max(3, Number(current.displaySeconds) || 3)}s shfaqje
            {current.priceEur != null ? ` · €${Number(current.priceEur)}` : ''}
          </div>
          <div className="mt-2 flex justify-center gap-2">
            {ads.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`h-3 w-3 rounded-full focus:outline-none ${i === active ? 'bg-black' : 'bg-gray-400'}`}
                onClick={() => setActive(i)}
                aria-label={`Go to ad ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-gray-500 dark:text-gray-300">Nuk ka asnjë reklamë.</div>
      )}
    </div>
  );
}
