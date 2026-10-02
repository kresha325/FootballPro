import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePosts } from '../contexts/PostsContext';
import { useAuth } from '../contexts/AuthContext';
import PersonName from './PersonName';
import VerifiedBadge from './VerifiedBadge';

function mediaUrl(apiRoot, url, cloudinarySafe) {
  if (!url) return '';
  const normalized = url.startsWith('https//')
    ? url.replace('https//', 'https://')
    : url.startsWith('http//')
      ? url.replace('http//', 'http://')
      : url;
  let full = /^https?:\/\//.test(normalized)
    ? normalized
    : apiRoot + (normalized.startsWith('/') ? normalized : `/${normalized}`);
  return cloudinarySafe ? cloudinarySafe(full) : full;
}

function isVideoUrl(url) {
  return !!url && /\.(mp4|mov|avi|webm)$/i.test(url);
}

/**
 * Immersive vertical feed pager (1:1 soft with mobile FeedPostPager).
 * Snap-scroll per post; like / comments / close.
 */
export default function FeedPostPager({
  posts,
  initialIndex = 0,
  onClose,
  getFullUrl,
  getCloudinarySafeUrl,
}) {
  const { user } = useAuth();
  const { likedPosts, toggleLike, postComments, fetchComments, addComment } = usePosts();
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, initialIndex));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const apiRoot = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '')
    : '';

  const resolve = useCallback(
    (url) => mediaUrl(apiRoot, url, getCloudinarySafeUrl || ((u) => u)),
    [apiRoot, getCloudinarySafeUrl]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = el.children[Math.max(0, Math.min(initialIndex, posts.length - 1))];
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start' });
      });
    }
  }, [initialIndex, posts.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const h = el.clientHeight || 1;
      const idx = Math.round(el.scrollTop / h);
      setActiveIndex(Math.max(0, Math.min(idx, posts.length - 1)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [posts.length]);

  const activePost = posts[activeIndex];
  const activeId = activePost?.id;

  useEffect(() => {
    if (commentsOpen && activeId) fetchComments(activeId);
  }, [commentsOpen, activeId, fetchComments]);

  const onSendComment = async () => {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await addComment(activeId, draft.trim());
      setDraft('');
      await fetchComments(activeId);
    } finally {
      setSending(false);
    }
  };

  if (!Array.isArray(posts) || posts.length === 0) return null;

  const comments = activeId ? postComments[activeId] || [] : [];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-3 py-3 sm:px-5">
        <p className="text-sm font-semibold text-white/80">
          {activeIndex + 1} / {posts.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"
        >
          Mbyll
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {posts.map((post, idx) => {
          const authorName =
            post.author?.firstName || post.author?.lastName
              ? `${post.author?.firstName || ''} ${post.author?.lastName || ''}`.trim()
              : 'I panjohur';
          const authorId = post.author?.id || post.userId;
          const img = post.imageUrl && !isVideoUrl(post.imageUrl) ? post.imageUrl : null;
          const vid = post.videoUrl || (isVideoUrl(post.imageUrl) ? post.imageUrl : null);
          const isActive = idx === activeIndex;
          const liked = likedPosts.has(post.id);

          return (
            <section
              key={post.id}
              className="relative flex h-[100dvh] w-full snap-start snap-always flex-col justify-end"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                {vid ? (
                  <video
                    src={resolve(vid)}
                    className="max-h-full max-w-full object-contain"
                    controls={isActive}
                    autoPlay={isActive}
                    muted={!isActive}
                    playsInline
                    loop
                  />
                ) : img ? (
                  <img
                    src={resolve(getFullUrl ? getFullUrl(img) : img)}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="max-w-lg px-6 text-center text-lg text-white/80">
                    {post.content || 'Pa media'}
                  </div>
                )}
              </div>

              <div className="relative z-10 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-6 pt-24 sm:px-6">
                <Link
                  to={authorId ? `/profile/${authorId}` : '#'}
                  onClick={(e) => {
                    if (!authorId) e.preventDefault();
                    else onClose?.();
                  }}
                  className="mb-2 inline-flex items-center gap-2 font-bold hover:underline"
                >
                  <PersonName>{authorName}</PersonName>
                  <VerifiedBadge verified={post.author?.verified} size="sm" />
                </Link>
                {post.content ? (
                  <p className="mb-3 max-w-xl whitespace-pre-wrap text-sm text-white/90 line-clamp-4">
                    {post.content}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      liked ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/25'
                    }`}
                  >
                    {liked ? '♥' : '♡'} {post.likes ?? 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCommentsOpen((v) => !v || activeIndex !== idx);
                      setActiveIndex(idx);
                    }}
                    className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25"
                  >
                    💬 {post.comments ?? comments.length ?? 0}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {commentsOpen && activePost ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[45vh] rounded-t-2xl border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Komente</p>
            <button type="button" className="text-sm text-white/70" onClick={() => setCommentsOpen(false)}>
              Mbyll
            </button>
          </div>
          <div className="mb-3 max-h-[28vh] space-y-2 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-white/50">Ende pa komente.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold">
                    {c.User?.firstName || c.author?.firstName || user?.firstName || 'User'}
                  </span>{' '}
                  <span className="text-white/80">{c.content}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white"
              placeholder="Shkruaj koment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSendComment();
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={onSendComment}
              className="rounded-lg bg-[var(--xt-color-gold,#9A6B12)] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Dërgo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
