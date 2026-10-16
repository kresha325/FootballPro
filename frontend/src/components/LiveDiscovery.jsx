import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { streamsAPI } from '../services/api';
import { useLocale } from '../contexts/LocaleContext';

const EMPTY = { live: [], upcoming: [], ended: [], featured: [] };

function streamerName(stream, t) {
  const person = stream?.streamer || {};
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || t('Transmetues');
}

function badge(stream, t) {
  if (stream?.isLive || stream?.status === 'live') return t('LIVE NOW');
  if (stream?.playback === 'replay' || stream?.status === 'available') return t('WATCH REPLAY');
  if (stream?.status === 'processing') return t('PROCESSING');
  if (stream?.status === 'scheduled' || stream?.status === 'ready') return t('UPCOMING');
  return String(stream?.status || 'STREAM').toUpperCase();
}

function StreamCard({ stream, t }) {
  return (
    <Link to={`/live/${stream.id}`} className="xt-card block overflow-hidden p-0 hover:opacity-95">
      <div className="relative aspect-video bg-slate-900">
        {stream.thumbnailUrl ? (
          <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">{badge(stream, t)}</div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold tracking-wide text-white">
          {badge(stream, t)}
        </span>
      </div>
      <div className="p-3">
        <p className="font-semibold text-[var(--xt-color-text)]">{stream.title}</p>
        <p className="mt-1 text-xs text-[var(--xt-color-text-muted)]">
          {streamerName(stream, t)}
          {stream.viewers ? ` · ${stream.viewers} ${t('shikues')}` : ''}
          {stream.provider ? ` · ${stream.provider}` : ''}
        </p>
      </div>
    </Link>
  );
}

function Section({ title, items, empty, t }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--xt-color-text)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--xt-color-text-muted)]">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((stream) => <StreamCard key={`${title}-${stream.id}`} stream={stream} t={t} />)}
        </div>
      )}
    </section>
  );
}

export default function LiveDiscovery() {
  const { t } = useLocale();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    tournamentId: searchParams.get('tournament') || '',
    clubId: searchParams.get('club') || '',
    matchId: searchParams.get('match') || '',
    from: '',
    to: '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (String(value || '').trim()) params[key] = String(value).trim();
    });
    streamsAPI.discovery(params)
      .then((res) => {
        if (cancelled) return;
        const body = res.data || {};
        setData({
          live: Array.isArray(body.live) ? body.live : [],
          upcoming: Array.isArray(body.upcoming) ? body.upcoming : [],
          ended: Array.isArray(body.ended) ? body.ended : [],
          featured: Array.isArray(body.featured) ? body.featured : [],
        });
      })
      .catch(() => {
        if (!cancelled) setError(t('Nuk u ngarkuan transmetimet.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, t]);

  const setField = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--xt-color-text)]">{t('Live')}</h1>
          <p className="text-sm text-[var(--xt-color-text-muted)]">{t('Transmetime reale nga FootballPro. Asnjë stream i rremë.')}</p>
        </div>
        <Link to="/streams" className="btn btn-quiet">{t('Biblioteka')}</Link>
      </div>

      <form className="xt-card grid gap-3 p-4 md:grid-cols-5" onSubmit={(event) => event.preventDefault()}>
        <label className="text-xs text-[var(--xt-color-text-muted)]">{t('Gara')}
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.tournamentId} onChange={setField('tournamentId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">{t('Klub')}
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.clubId} onChange={setField('clubId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">{t('Ndeshje')}
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.matchId} onChange={setField('matchId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">{t('Nga')}
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" type="date" value={filters.from} onChange={setField('from')} />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">{t('Deri')}
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" type="date" value={filters.to} onChange={setField('to')} />
        </label>
      </form>

      {loading ? <p className="text-sm text-[var(--xt-color-text-muted)]">{t('Duke ngarkuar transmetimet…')}</p> : null}
      {error ? (
        <div className="xt-card p-4" role="alert">
          <p className="text-sm text-[var(--xt-color-danger,#b91c1c)]">{error}</p>
          <button type="button" className="btn btn-primary mt-3" onClick={() => setFilters((prev) => ({ ...prev }))}>{t('Provo përsëri')}</button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <Section title={t('LIVE NOW')} items={data.live} empty={t('Asnjë transmetim live tani.')} t={t} />
          <Section title={t('UPCOMING')} items={data.upcoming} empty={t('Asnjë transmetim i planifikuar.')} t={t} />
          <Section title={t('RECENTLY ENDED')} items={data.ended} empty={t('Asnjë transmetim i mbyllur së fundmi.')} t={t} />
          <Section title={t('FEATURED')} items={data.featured} empty={t('Asnjë transmetim i veçuar.')} t={t} />
        </>
      ) : null}
    </div>
  );
}
