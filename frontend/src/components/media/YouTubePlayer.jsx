import { useState } from 'react';
import { youtubeEmbedUrl, isValidYouTubeVideoId } from '../../utils/youtubeVideo';

/**
 * Privacy-enhanced YouTube embed (16:9). Lazy-loads iframe after click or when eager.
 */
export default function YouTubePlayer({
  videoId,
  title = 'YouTube video',
  className = '',
  eager = false,
  posterUrl,
}) {
  const [loaded, setLoaded] = useState(!!eager);
  const [errored, setErrored] = useState(false);
  const valid = isValidYouTubeVideoId(videoId);
  const src = valid ? `${youtubeEmbedUrl(videoId)}?rel=0&modestbranding=1` : '';
  const poster =
    posterUrl ||
    (valid ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '');

  if (!valid) {
    return (
      <div
        className={`relative flex aspect-video w-full items-center justify-center rounded-lg bg-black/40 text-sm text-white/70 ${className}`}
        role="alert"
      >
        Video YouTube i pavlefshëm
      </div>
    );
  }

  if (errored) {
    return (
      <div
        className={`relative flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-black/50 text-sm text-white/80 ${className}`}
        role="alert"
      >
        <p>Nuk u ngarkua videoja.</p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[var(--xt-color-gold,#9A6B12)]"
        >
          Hap në YouTube
        </a>
      </div>
    );
  }

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black ${className}`}>
      {!loaded ? (
        <button
          type="button"
          className="group absolute inset-0 flex items-center justify-center"
          onClick={() => setLoaded(true)}
          aria-label={`Luaj: ${title}`}
        >
          {poster ? (
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              loading="lazy"
            />
          ) : null}
          <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      ) : (
        <iframe
          title={title}
          src={src}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
