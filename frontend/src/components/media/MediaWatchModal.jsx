import { useEffect } from 'react';
import YouTubePlayer from './YouTubePlayer';
import { MEDIA_CATEGORIES } from '../../utils/youtubeVideo';
import { mediaAPI } from '../../services/api';

const categoryLabel = (value) =>
  MEDIA_CATEGORIES.find((c) => c.value === value)?.label || value || 'Video';

export default function MediaWatchModal({ item, onClose }) {
  useEffect(() => {
    if (!item?.id) return undefined;
    mediaAPI.trackEvent(item.id, 'open').catch(() => {});
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item?.id, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl bg-[var(--xt-color-surface,#fff)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--xt-color-border,#e2e8f0)] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--xt-color-gold,#9A6B12)]">
              {categoryLabel(item.category)}
            </p>
            <h2 className="text-lg font-bold text-[var(--xt-color-text,#0f172a)]">{item.title}</h2>
          </div>
          <button type="button" className="btn btn-quiet min-h-9 px-3" onClick={onClose} aria-label="Mbyll">
            ✕
          </button>
        </div>
        <div className="p-4">
          <YouTubePlayer
            videoId={item.youtubeVideoId}
            title={item.title}
            posterUrl={item.thumbnailUrl}
            eager
          />
          {item.description ? (
            <p className="mt-3 text-sm text-[var(--xt-color-text-muted,#64748b)] whitespace-pre-wrap">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
