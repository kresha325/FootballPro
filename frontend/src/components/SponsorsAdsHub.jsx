import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adsAPI, sponsorAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EUR_PER_UNIT = 1;
const SECONDS_PER_UNIT = 3;

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

function tabFromPath(pathname) {
  if (pathname.includes('/ads')) return 'ads';
  return 'sponsors';
}

export default function SponsorsAdsHub() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPath(location.pathname);

  const [sponsors, setSponsors] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // Sponsor form
  const [editingId, setEditingId] = useState(null);
  const [sName, setSName] = useState('');
  const [sLink, setSLink] = useState('');
  const [sImage, setSImage] = useState(null);

  // Ad form
  const [aTitle, setATitle] = useState('');
  const [aText, setAText] = useState('');
  const [aColor, setAColor] = useState('#34d399');
  const [aDays, setADays] = useState(1);
  const [aMedia, setAMedia] = useState(null);
  const [aMediaUrl, setAMediaUrl] = useState('');
  const [aMediaKind, setAMediaKind] = useState(null);
  const [aMediaDurationSec, setAMediaDurationSec] = useState(null);

  const pricing = useMemo(() => {
    const d = Math.max(1, parseInt(String(aDays || '1'), 10) || 1);
    const perDay =
      aMediaKind === 'video' && aMediaDurationSec
        ? pricePerDayFromSeconds(aMediaDurationSec)
        : EUR_PER_UNIT;
    const displaySeconds =
      aMediaKind === 'video' && aMediaDurationSec ? aMediaDurationSec : SECONDS_PER_UNIT;
    return { days: d, pricePerDay: perDay, displaySeconds, priceEur: perDay * d };
  }, [aDays, aMediaKind, aMediaDurationSec]);

  const loadSponsors = useCallback(async () => {
    if (!user?.id) {
      setSponsors([]);
      return;
    }
    try {
      const res = await sponsorAPI.getSponsorsByUser(user.id);
      setSponsors(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSponsors([]);
    }
  }, [user?.id]);

  const loadAds = useCallback(async () => {
    try {
      const res = await adsAPI.getAds();
      setAds(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAds([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      await Promise.all([loadSponsors(), loadAds()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSponsors, loadAds]);

  const resetSponsorForm = () => {
    setEditingId(null);
    setSName('');
    setSLink('');
    setSImage(null);
  };

  const onEditSponsor = (item) => {
    setEditingId(item.id);
    setSName(item.name || '');
    setSLink(item.link || '');
    setSImage(null);
    setError('');
    setOkMsg('');
  };

  const onDeleteSponsor = async (id) => {
    if (!window.confirm('Fshi këtë sponsor?')) return;
    setError('');
    try {
      await sponsorAPI.deleteSponsor(id);
      if (editingId === id) resetSponsorForm();
      await loadSponsors();
      setOkMsg('Sponsori u fshi.');
    } catch {
      setError('Fshirja e sponsorit dështoi.');
    }
  };

  const onSaveSponsor = async (e) => {
    e.preventDefault();
    if (!user?.id) {
      setError('Duhet të jesh i kyçur.');
      return;
    }
    if (!sName.trim()) {
      setError('Emri i sponsorit është i detyrueshëm.');
      return;
    }
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      if (editingId) {
        await sponsorAPI.updateSponsor(editingId, { name: sName.trim(), link: sLink.trim() });
        setOkMsg('Sponsori u përditësua.');
      } else {
        const fd = new FormData();
        fd.append('userId', String(user.id));
        fd.append('name', sName.trim());
        if (sLink.trim()) fd.append('link', sLink.trim());
        if (sImage) fd.append('image', sImage);
        const res = await sponsorAPI.createSponsor(fd);
        const plan = String(res?.data?.subscriptionPlan || '').toLowerCase();
        const count = Number(res?.data?.sponsorCount || 0);
        const planLabel = plan === 'premium' ? 'Premium' : plan === 'basic' ? 'Basic' : 'Free';
        setOkMsg(`Sponsor u krijua. Aktivë: ${count || '—'} · Plani: ${planLabel}`);
      }
      resetSponsorForm();
      await loadSponsors();
    } catch {
      setError(editingId ? 'Përditësimi dështoi.' : 'Krijimi i sponsorit dështoi.');
    } finally {
      setSaving(false);
    }
  };

  const onAdMediaChange = (e) => {
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
        setAMedia(file);
        setAMediaUrl(url);
        setAMediaKind('video');
        setAMediaDurationSec(sec);
      };
      videoEl.src = url;
      return;
    }
    setAMedia(file);
    setAMediaUrl(url);
    setAMediaKind('image');
    setAMediaDurationSec(null);
  };

  const onCreateAd = async (e) => {
    e.preventDefault();
    if (!aTitle.trim() || !aText.trim()) {
      setError('Titulli dhe teksti janë të detyrueshëm.');
      return;
    }
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const data = new FormData();
      data.append('title', aTitle.trim());
      data.append('text', aText.trim());
      data.append('color', aColor || '#34d399');
      data.append('days', String(pricing.days));
      if (aMediaDurationSec) data.append('mediaDurationSec', String(aMediaDurationSec));
      if (aMedia) {
        if (aMediaKind === 'video') data.append('video', aMedia);
        else data.append('image', aMedia);
      }
      await adsAPI.createAd(data);
      setATitle('');
      setAText('');
      setAColor('#34d399');
      setADays(1);
      setAMedia(null);
      setAMediaUrl('');
      setAMediaKind(null);
      setAMediaDurationSec(null);
      await loadAds();
      setOkMsg('Reklama u krijua.');
      window.dispatchEvent(new CustomEvent('ads-updated'));
    } catch {
      setError('Krijimi i reklamës dështoi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sponsorë & Reklama</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Menaxho sponsorët e profilit dhe reklamat në feed — njëjtë si në app.
          </p>
        </div>
        <Link
          to="/premium"
          className="text-sm font-semibold text-[var(--xt-color-gold-bright,#9A6B12)] hover:underline"
        >
          Planet Premium →
        </Link>
      </div>

      <div className="mb-6 flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate('/sponsors')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === 'sponsors'
              ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Sponsorë
        </button>
        <button
          type="button"
          onClick={() => navigate('/ads')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === 'ads'
              ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Reklama
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {okMsg}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Duke ngarkuar…</p>
      ) : tab === 'sponsors' ? (
        <div className="space-y-6">
          <form
            onSubmit={onSaveSponsor}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
              {editingId ? 'Ndrysho sponsorin' : 'Shto sponsor'}
            </h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Emri *"
                value={sName}
                onChange={(e) => setSName(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Link (opsional)"
                value={sLink}
                onChange={(e) => setSLink(e.target.value)}
              />
              {!editingId ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSImage(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 dark:text-gray-300"
                />
              ) : (
                <p className="text-xs text-gray-500">Fotoja nuk ndryshohet këtu (vetëm emri/linku).</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#9A6B12] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Duke ruajtur…' : editingId ? 'Ruaj' : 'Krijo'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetSponsorForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600"
                  >
                    Anulo
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Lista ({sponsors.length})
            </h2>
            {sponsors.length === 0 ? (
              <p className="text-sm text-gray-500">Nuk ke sponsorë ende.</p>
            ) : (
              sponsors.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      {s.image || s.logo ? (
                        <img
                          src={mediaUrl(s.image || s.logo)}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="truncate text-sm text-gray-500">{s.link || 'Pa link'}</p>
                        <p className="text-xs text-gray-400">
                          {s.startDate ? String(s.startDate).slice(0, 10) : '—'} →{' '}
                          {s.endDate ? String(s.endDate).slice(0, 10) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onEditSponsor(s)}
                      className="text-sm font-semibold text-[#9A6B12]"
                    >
                      Ndrysho
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSponsor(s.id)}
                      className="text-sm font-semibold text-red-600"
                    >
                      Fshi
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={onCreateAd}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Krijo reklamë</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Titulli *"
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                required
              />
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Teksti *"
                rows={3}
                value={aText}
                onChange={(e) => setAText(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  type="color"
                  value={aColor}
                  onChange={(e) => setAColor(e.target.value)}
                  title="Ngjyra"
                />
                <input
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  type="number"
                  min={1}
                  value={aDays}
                  onChange={(e) => setADays(e.target.value)}
                  placeholder="Ditë"
                />
              </div>
              <p className="text-xs text-gray-500">
                €{EUR_PER_UNIT}/ditë = {SECONDS_PER_UNIT}s media. Video 12s → €4/ditë. Total = çmimi ditor ×
                ditët.
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {aMediaKind === 'video' && aMediaDurationSec
                  ? `Video ${aMediaDurationSec}s → €${pricing.pricePerDay}/ditë × ${pricing.days} = €${pricing.priceEur}`
                  : `€${pricing.pricePerDay}/ditë × ${pricing.days} = €${pricing.priceEur}`}
              </p>
              <input type="file" accept="image/*,video/*" onChange={onAdMediaChange} />
              {aMediaUrl ? (
                aMediaKind === 'video' ? (
                  <video src={aMediaUrl} controls className="mt-2 max-h-40 rounded-lg" />
                ) : (
                  <img src={aMediaUrl} alt="" className="mt-2 max-h-40 rounded-lg object-contain" />
                )
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#9A6B12] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Duke ruajtur…' : 'Krijo reklamë'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reklamat ({ads.length})</h2>
            {ads.length === 0 ? (
              <p className="text-sm text-gray-500">Nuk ka reklama aktive.</p>
            ) : (
              ads.map((ad) => {
                const days =
                  ad?.startDate && ad?.endDate
                    ? Math.max(
                        1,
                        Math.round((new Date(ad.endDate) - new Date(ad.startDate)) / 86400000)
                      )
                    : null;
                return (
                  <div
                    key={ad.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex gap-3">
                      {ad.image || ad.videoUrl ? (
                        ad.mediaType === 'video' || ad.videoUrl ? (
                          <video
                            src={mediaUrl(ad.videoUrl || ad.image)}
                            className="h-16 w-16 rounded-lg object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={mediaUrl(ad.image)}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        )
                      ) : (
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: ad.color || '#34d399' }}
                        >
                          Ad
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-white">{ad.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{ad.text}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {ad.mediaType === 'video' ? 'Video' : 'Foto'}
                          {ad.displaySeconds ? ` · ${ad.displaySeconds}s` : ''}
                          {ad.priceEur != null ? ` · €${Number(ad.priceEur).toFixed(0)}` : ''}
                          {days ? ` · ${days} ditë` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
