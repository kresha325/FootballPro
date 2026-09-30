import { useCallback, useEffect, useState } from 'react';
import { mediaAPI, extractApiMessage } from '../services/api';
import { MEDIA_CATEGORIES, MEDIA_VISIBILITIES } from '../utils/youtubeVideo';
import MediaWatchModal from './media/MediaWatchModal';

export default function AdminMedia() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('');
  const [season, setSeason] = useState('');
  const [clubId, setClubId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [watching, setWatching] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: nextPage, limit: 20 };
      if (q.trim()) params.q = q.trim();
      if (category) params.category = category;
      if (visibility) params.visibility = visibility;
      if (season.trim()) params.season = season.trim();
      if (clubId.trim()) params.clubId = clubId.trim();
      if (playerId.trim()) params.playerId = playerId.trim();
      if (matchId.trim()) params.matchId = matchId.trim();
      const { data } = await mediaAPI.adminList(params);
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || nextPage);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(extractApiMessage(err, 'Nuk u ngarkua media'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, category, visibility, season, clubId, playerId, matchId]);

  useEffect(() => {
    load(1);
  }, [load]);

  const onDelete = async (item) => {
    if (!window.confirm(`Fshi videon “${item.title}”?`)) return;
    setBusy(true);
    try {
      await mediaAPI.remove(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      window.alert(extractApiMessage(err, 'Fshirja dështoi'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="xt-card p-4 space-y-3">
        <h2 className="text-xl font-bold text-[var(--xt-color-text)]">Media Management (YouTube)</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded border p-2 text-sm"
            placeholder="Kërko titull / URL / ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="rounded border p-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Të gjitha kategoritë</option>
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select className="rounded border p-2 text-sm" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="">Të gjitha visibility</option>
            {MEDIA_VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
          <input
            className="rounded border p-2 text-sm"
            placeholder="Sezoni"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <input className="rounded border p-2 text-sm" placeholder="Club ID" value={clubId} onChange={(e) => setClubId(e.target.value)} />
          <input className="rounded border p-2 text-sm" placeholder="Player ID" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
          <input className="rounded border p-2 text-sm" placeholder="Match ID" value={matchId} onChange={(e) => setMatchId(e.target.value)} />
          <button type="button" className="btn btn-primary min-h-10" onClick={() => load(1)}>Filtro</button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {loading ? (
        <div className="xt-card p-6 text-sm text-gray-500">Duke ngarkuar…</div>
      ) : items.length === 0 ? (
        <div className="xt-card p-6 text-sm text-gray-500">Nuk u gjet asnjë media.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="xt-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-3">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded bg-slate-200 text-xs">No thumb</div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--xt-color-text)]">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    #{item.id} · {item.category} · {item.visibility}
                    {item.clubId ? ` · club ${item.clubId}` : ''}
                    {item.playerId ? ` · player ${item.playerId}` : ''}
                    {item.matchId ? ` · match ${item.matchId}` : ''}
                    {item.season ? ` · ${item.season}` : ''}
                  </p>
                  <a
                    href={item.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-blue-600 underline"
                  >
                    {item.youtubeUrl}
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-quiet min-h-10 px-3 text-sm" onClick={() => setWatching(item)}>
                  Hap
                </button>
                <button
                  type="button"
                  className="btn btn-quiet min-h-10 px-3 text-sm text-red-600"
                  disabled={busy}
                  onClick={() => onDelete(item)}
                >
                  Fshi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          <button type="button" className="btn btn-quiet" disabled={page <= 1} onClick={() => load(page - 1)}>
            Previous
          </button>
          <span className="self-center text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button type="button" className="btn btn-quiet" disabled={page >= totalPages} onClick={() => load(page + 1)}>
            Next
          </button>
        </div>
      ) : null}

      <MediaWatchModal item={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
