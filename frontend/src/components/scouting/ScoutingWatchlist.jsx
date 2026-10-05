import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

export default function ScoutingWatchlist() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await scoutingAPI.getWatchlist({ page, limit: 20 });
      if (!signal.aborted) setData(response.data);
    } catch (err) {
      if (!signal.aborted) setError(apiError(err, 'Watchlista nuk u ngarkua.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadKey]);

  async function remove(item) {
    try {
      await scoutingAPI.removeWatchlist(item.id);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Heqja dështoi.'));
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && !data) return <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} />;

  const items = data?.items || [];
  const changes = data?.changes || [];
  const total = Number(data?.total) || 0;

  return (
    <div className="space-y-4">
      {error ? <ErrorBlock message={error} /> : null}
      <section className="xt-card p-4">
        <h2 className="text-xl font-semibold">Ndryshimet e fundit</h2>
        {changes.length === 0 ? <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">Nuk ka ndryshime të konfirmuara. Njoftimet krijohen vetëm kur klubi, kompeticioni, ndeshja, golat, arritjet ose videot publike ndryshojnë.</p> : (
          <ul className="mt-3 space-y-2 text-sm">{changes.map((change) => <li key={change.id}>{change.summary}</li>)}</ul>
        )}
      </section>
      {items.length === 0 ? <EmptyBlock title="Watchlista është bosh" text="Ndiq lojtarë nga zbulimi për të parë ndryshimet e tyre." /> : items.map((item) => {
        const last = item.player?.trend?.matches?.[0];
        return (
          <article className="xt-card p-4" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link className="text-lg font-semibold" to={`/profile/${item.playerId}`}>{item.player?.playerName || `Lojtari ${item.playerId}`}</Link>
                <p className="text-sm text-[var(--xt-color-text-muted)]">
                  Shtuar {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  {item.player?.club ? ` · ${item.player.club}` : ''}
                </p>
                <p className="mt-2 text-sm">
                  {last
                    ? `Ndeshja e fundit: ${last.competition || 'Kompeticion'} · ${last.goals} gola · ${last.assists} asiste · ${last.minutes} min`
                    : 'Nuk ka ndeshje zyrtare të regjistruara.'}
                </p>
              </div>
              <button type="button" className="btn btn-quiet" onClick={() => remove(item)}>Hiq</button>
            </div>
          </article>
        );
      })}
      {total > 20 ? (
        <div className="flex justify-center gap-3">
          <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Para</button>
          <button type="button" className="btn btn-outline" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Tjetra</button>
        </div>
      ) : null}
    </div>
  );
}
