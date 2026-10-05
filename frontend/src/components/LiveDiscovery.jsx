import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { streamsAPI } from '../services/api';

const EMPTY = { live: [], upcoming: [], ended: [], featured: [] };

function streamerName(stream) {
  const person = stream?.streamer || {};
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Broadcaster';
}

function badge(stream) {
  if (stream?.isLive || stream?.status === 'live') return 'LIVE NOW';
  if (stream?.playback === 'replay' || stream?.status === 'available') return 'WATCH REPLAY';
  if (stream?.status === 'processing') return 'PROCESSING';
  if (stream?.status === 'scheduled' || stream?.status === 'ready') return 'UPCOMING';
  return String(stream?.status || 'STREAM').toUpperCase();
}

function StreamCard({ stream }) {
  return (
    <Link to={`/live/${stream.id}`} className="xt-card block overflow-hidden p-0 hover:opacity-95">
      <div className="relative aspect-video bg-slate-900">
        {stream.thumbnailUrl ? (
          <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">{badge(stream)}</div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold tracking-wide text-white">
          {badge(stream)}
        </span>
      </div>
      <div className="p-3">
        <p className="font-semibold text-[var(--xt-color-text)]">{stream.title}</p>
        <p className="mt-1 text-xs text-[var(--xt-color-text-muted)]">
          {streamerName(stream)}
          {stream.viewers ? ` · ${stream.viewers} shikues` : ''}
          {stream.provider ? ` · ${stream.provider}` : ''}
        </p>
      </div>
    </Link>
  );
}

function Section({ title, items, empty }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--xt-color-text)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--xt-color-text-muted)]">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((stream) => <StreamCard key={`${title}-${stream.id}`} stream={stream} />)}
        </div>
      )}
    </section>
  );
}

export default function LiveDiscovery() {
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
        if (!cancelled) setError('Nuk u ngarkuan transmetimet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const setField = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--xt-color-text)]">Live</h1>
          <p className="text-sm text-[var(--xt-color-text-muted)]">Transmetime reale nga FootballPro. Asnjë stream i rremë.</p>
        </div>
        <Link to="/streams" className="btn btn-quiet">Biblioteka</Link>
      </div>

      <form className="xt-card grid gap-3 p-4 md:grid-cols-5" onSubmit={(event) => event.preventDefault()}>
        <label className="text-xs text-[var(--xt-color-text-muted)]">Gara
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.tournamentId} onChange={setField('tournamentId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">Klub
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.clubId} onChange={setField('clubId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">Ndeshje
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={filters.matchId} onChange={setField('matchId')} inputMode="numeric" />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">Nga
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" type="date" value={filters.from} onChange={setField('from')} />
        </label>
        <label className="text-xs text-[var(--xt-color-text-muted)]">Deri
          <input className="mt-1 w-full rounded border px-2 py-1 text-sm" type="date" value={filters.to} onChange={setField('to')} />
        </label>
      </form>

      {loading ? <p className="text-sm text-[var(--xt-color-text-muted)]">Duke ngarkuar transmetimet…</p> : null}
      {error ? (
        <div className="xt-card p-4" role="alert">
          <p className="text-sm text-[var(--xt-color-danger,#b91c1c)]">{error}</p>
          <button type="button" className="btn btn-primary mt-3" onClick={() => setFilters((prev) => ({ ...prev }))}>Provo përsëri</button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <Section title="LIVE NOW" items={data.live} empty="Asnjë transmetim live tani." />
          <Section title="UPCOMING" items={data.upcoming} empty="Asnjë transmetim i planifikuar." />
          <Section title="RECENTLY ENDED" items={data.ended} empty="Asnjë transmetim i mbyllur së fundmi." />
          <Section title="FEATURED" items={data.featured} empty="Asnjë transmetim i veçuar." />
        </>
      ) : null}
    </div>
  );
}
