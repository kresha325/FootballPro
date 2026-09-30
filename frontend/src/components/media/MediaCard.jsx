import { MEDIA_CATEGORIES } from '../../utils/youtubeVideo';
import { youtubeThumbnailUrl } from '../../utils/youtubeVideo';

const categoryLabel = (value) =>
  MEDIA_CATEGORIES.find((c) => c.value === value)?.label || value || 'Video';

export default function MediaCard({ item, onOpen, onImpression }) {
  if (!item) return null;

  const thumb =
    item.thumbnailUrl ||
    (item.youtubeVideoId ? youtubeThumbnailUrl(item.youtubeVideoId) : '');
  const date = item.publishedAt || item.createdAt;

  return (
    <button
      type="button"
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-[var(--xt-color-border,#e2e8f0)] bg-[var(--xt-color-surface,#fff)] text-left shadow-sm transition hover:border-[var(--xt-color-gold,#9A6B12)]/50"
      onClick={() => onOpen?.(item)}
      onFocus={() => onImpression?.(item)}
      onMouseEnter={() => onImpression?.(item)}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/50 text-sm">Pa thumbnail</div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {categoryLabel(item.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-[var(--xt-color-text,#0f172a)]">
          {item.title}
        </h3>
        <p className="text-xs text-[var(--xt-color-text-muted,#64748b)]">
          {date ? new Date(date).toLocaleDateString() : ''}
          {item.matchId ? ` · Match #${item.matchId}` : ''}
        </p>
      </div>
    </button>
  );
}
