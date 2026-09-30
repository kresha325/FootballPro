import MediaCard from './MediaCard';

export default function MediaGrid({
  items = [],
  loading = false,
  emptyTitle = 'Nuk ka video ende',
  emptyHint = 'Shto një link YouTube për të shfaqur median këtu.',
  onOpen,
  onImpression,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-xl border border-[var(--xt-color-border,#e2e8f0)]"
          >
            <div className="aspect-video bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--xt-color-border,#e2e8f0)] px-6 py-12 text-center">
        <p className="text-base font-semibold text-[var(--xt-color-text,#0f172a)]">{emptyTitle}</p>
        <p className="mt-1 text-sm text-[var(--xt-color-text-muted,#64748b)]">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            onImpression={onImpression}
          />
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn btn-quiet min-h-10 px-4"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Duke ngarkuar…' : 'Shfaq më shumë'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
