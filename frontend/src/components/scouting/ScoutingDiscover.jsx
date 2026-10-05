import { useCallback, useEffect, useState } from 'react';
import { scoutingAPI } from '../../services/api';
import ScoutPlayerCard from './ScoutPlayerCard';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

const EMPTY = {
  q: '', position: '', country: '', city: '', club: '', minAge: '', maxAge: '', foot: '',
  minHeight: '', maxHeight: '', minWeight: '', maxWeight: '', playingLevel: '', category: '',
  minExperience: '', competition: '', season: '', minAppearances: '', minGoals: '', minAssists: '',
  minMinutes: '', minRating: '', minRecentRating: '',
};

export default function ScoutingDiscover() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '') params[key] = value;
    });
    try {
      const response = await scoutingAPI.getPlayers(params, { signal });
      if (!signal.aborted) setResult(response.data);
    } catch (err) {
      if (!signal.aborted) {
        setResult(null);
        setError(apiError(err, 'Lojtarët nuk u ngarkuan.'));
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [load, reloadKey]);

  const players = result?.players || [];
  const total = Number(result?.total) || 0;
  const limit = Number(result?.limit) || 20;

  return (
    <div className="space-y-4">
      <form className="xt-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setPage(1); setReloadKey((value) => value + 1); }}>
        {[
          ['q', 'Emri'],
          ['position', 'Pozicioni'],
          ['country', 'Shteti'],
          ['city', 'Qyteti'],
          ['club', 'Klubi'],
          ['competition', 'Kompeticioni'],
          ['season', 'Sezoni'],
          ['playingLevel', 'Niveli'],
          ['category', 'Kategoria'],
        ].map(([name, label]) => (
          <label key={name}><span className="label">{label}</span>
            <input className="input" name={name} value={filters[name]} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, [name]: event.target.value })); }} />
          </label>
        ))}
        <label><span className="label">Këmba</span>
          <select className="select" value={filters.foot} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, foot: event.target.value })); }}>
            <option value="">Çdo këmbë</option>
            <option value="left">Majtas</option>
            <option value="right">Djathtas</option>
            <option value="both">Të dyja</option>
          </select>
        </label>
        {[
          ['minAge', 'Mosha min'], ['maxAge', 'Mosha max'], ['minHeight', 'Gjatësia min'], ['maxHeight', 'Gjatësia max'],
          ['minWeight', 'Pesha min'], ['maxWeight', 'Pesha max'], ['minExperience', 'Përvojë (vite)'],
          ['minAppearances', 'Ndeshje min'], ['minGoals', 'Gola min'], ['minAssists', 'Asiste min'],
          ['minMinutes', 'Minuta min'], ['minRating', 'Rating min'], ['minRecentRating', 'Forma (5 ndeshje)'],
        ].map(([name, label]) => (
          <label key={name}><span className="label">{label}</span>
            <input className="input" type="number" name={name} value={filters[name]} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, [name]: event.target.value })); }} />
          </label>
        ))}
        <div className="flex items-end"><button type="button" className="btn btn-quiet" onClick={() => { setFilters(EMPTY); setPage(1); }}>Pastro</button></div>
      </form>
      {result?.capped ? <p className="text-sm text-[var(--xt-color-text-muted)]">Filtri i performancës u kufizua te lojtarët me statistikat më të forta. Ngushto kriteret për një listë më të saktë.</p> : null}
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : players.length === 0 ? (
        <EmptyBlock title="Nuk u gjetën lojtarë" text="Ndrysho filtrat. Kartat përdorin vetëm profile dhe statistika zyrtare." />
      ) : (
        <>
          <p className="text-sm text-[var(--xt-color-text-muted)]">{total} lojtarë</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {players.map((player) => <ScoutPlayerCard key={player.playerId} player={player} onChange={() => setReloadKey((value) => value + 1)} />)}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Para</button>
            <span className="text-sm">Faqja {page}</span>
            <button type="button" className="btn btn-outline" disabled={page * limit >= total} onClick={() => setPage((value) => value + 1)}>Tjetra</button>
          </div>
        </>
      )}
    </div>
  );
}
