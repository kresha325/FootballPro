import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

const STATUSES = ['NEW', 'WATCHING', 'SHORTLISTED', 'CONTACTED', 'TRIAL', 'OFFER', 'SIGNED', 'REJECTED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function ScoutingShortlist() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await scoutingAPI.getShortlist({ page, limit: 20 });
      if (signal.aborted) return;
      setItems(response.data?.items || []);
      setTotal(Number(response.data?.total) || 0);
    } catch (err) {
      if (!signal.aborted) setError(apiError(err, 'Shortlista nuk u ngarkua.'));
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

  async function save(item, patch) {
    setError('');
    try {
      await scoutingAPI.updateShortlist(item.id, patch);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Ndryshimi nuk u ruajt.'));
    }
  }

  async function remove(item) {
    setError('');
    try {
      await scoutingAPI.removeShortlist(item.id);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Heqja dështoi.'));
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && items.length === 0) return <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} />;

  return (
    <div className="space-y-3">
      {error ? <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {items.length === 0 ? <EmptyBlock title="Shortlista është bosh" text="Shto lojtarë nga zbulimi." /> : items.map((item) => (
        <article className="xt-card space-y-3 p-4" key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link className="text-lg font-semibold" to={`/profile/${item.playerId}`}>{item.player?.playerName || `Lojtari ${item.playerId}`}</Link>
              <p className="text-sm text-[var(--xt-color-text-muted)]">{[item.player?.position, item.player?.club].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" className="btn btn-quiet" onClick={() => remove(item)}>Hiq</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">Statusi</span>
              <select className="select" value={item.status} onChange={(event) => save(item, { status: event.target.value })}>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label><span className="label">Prioriteti</span>
              <select className="select" value={item.priority} onChange={(event) => save(item, { priority: event.target.value })}>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>
            <label><span className="label">Data e ndjekjes</span>
              <input className="input" type="date" defaultValue={item.followUpDate || ''} onBlur={(event) => save(item, { followUpDate: event.target.value })} />
            </label>
          </div>
          <label><span className="label">Shënim</span>
            <textarea className="input min-h-20" defaultValue={item.note || ''} onBlur={(event) => save(item, { note: event.target.value })} />
          </label>
        </article>
      ))}
      {total > 20 ? (
        <div className="flex justify-center gap-3">
          <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Para</button>
          <button type="button" className="btn btn-outline" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Tjetra</button>
        </div>
      ) : null}
    </div>
  );
}
