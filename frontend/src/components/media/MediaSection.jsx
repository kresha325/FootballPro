import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaAPI } from '../../services/api';
import MediaGrid from './MediaGrid';
import MediaWatchModal from './MediaWatchModal';
import AddMediaModal from './AddMediaModal';

/**
 * Reusable media section for player / club / match contexts.
 */
export default function MediaSection({
  context = 'player', // player | club | match
  entityId,
  canManage = false,
  title = 'Media',
  defaultCategory,
  categoryFilter,
  defaults = {},
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [watching, setWatching] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const impressed = useRef(new Set());

  const fetchPage = useCallback(
    async (nextPage, { append } = { append: false }) => {
      if (!entityId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = { page: nextPage, limit: 12 };
        const cats = String(categoryFilter || '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        if (cats.length === 1) params.category = cats[0];
        let res;
        if (context === 'club') res = await mediaAPI.listClub(entityId, params);
        else if (context === 'match') res = await mediaAPI.listMatch(entityId, params);
        else res = await mediaAPI.listPlayer(entityId, params);
        const data = res.data || {};
        let list = Array.isArray(data.items) ? data.items : [];
        if (cats.length > 1) {
          list = list.filter((it) => cats.includes(it.category));
        }
        setItems((prev) => (append ? [...prev, ...list] : list));
        setPage(data.page || nextPage);
        setTotalPages(data.totalPages || 1);
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [context, entityId, categoryFilter]
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const onImpression = (item) => {
    if (!item?.id || impressed.current.has(item.id)) return;
    impressed.current.add(item.id);
    mediaAPI.trackEvent(item.id, 'impression').catch(() => {});
  };

  const onOpen = (item) => {
    mediaAPI.trackEvent(item.id, context === 'player' || context === 'club' ? 'profile_click' : 'open').catch(() => {});
    setWatching(item);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[var(--xt-color-text,#0f172a)]">{title}</h3>
        {canManage ? (
          <button type="button" className="btn btn-primary min-h-10 px-4" onClick={() => setShowAdd(true)}>
            Shto video
          </button>
        ) : null}
      </div>

      <MediaGrid
        items={items}
        loading={loading}
        onOpen={onOpen}
        onImpression={onImpression}
        hasMore={page < totalPages}
        loadingMore={loadingMore}
        onLoadMore={() => fetchPage(page + 1, { append: true })}
        emptyHint={
          canManage
            ? 'Ngarko videon në YouTube dhe shto linkun këtu.'
            : 'Nuk ka video YouTube për këtë profil ende.'
        }
      />

      <MediaWatchModal item={watching} onClose={() => setWatching(null)} />
      <AddMediaModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        defaults={{
          ...defaults,
          category: defaultCategory || defaults.category,
          ...(context === 'player' ? { playerId: entityId } : {}),
          ...(context === 'club' ? { clubId: entityId } : {}),
          ...(context === 'match' ? { matchId: entityId } : {}),
        }}
        onSaved={(item) => {
          setItems((prev) => [item, ...prev]);
          mediaAPI.trackEvent(item.id, 'page_open').catch(() => {});
        }}
      />
    </section>
  );
}
