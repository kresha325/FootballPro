import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import YouTubePlayer from './YouTubePlayer';
import { getFullUrl } from '../../utils/mediaUrl';

/**
 * One player for uploaded video, YouTube, replay, and a live handoff.
 * LiveKit rooms stay on /live/:id so credentials never reach this component.
 */
export default function MediaPlayer({
  kind = 'file',
  src,
  youtubeId,
  title = 'Video',
  poster,
  streamId,
  status,
  className = '',
}) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(kind === 'file' || kind === 'replay');

  if (kind === 'loading') {
    return <PlayerFrame className={className}><p className="text-sm text-white/80">Duke u ngarkuar…</p></PlayerFrame>;
  }

  if (kind === 'youtube' || youtubeId) {
    return <YouTubePlayer videoId={youtubeId} title={title} posterUrl={poster} className={className} />;
  }

  if (kind === 'livekit' || kind === 'live') {
    return (
      <PlayerFrame className={className} poster={poster}>
        <div className="relative z-10 px-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-red-300">{status || 'LIVE'}</p>
          <p className="mt-2 text-base font-semibold text-white">{title}</p>
          {streamId ? (
            <Link to={`/live/${streamId}`} className="btn btn-primary mt-4 inline-flex">
              Shiko live
            </Link>
          ) : (
            <p className="mt-3 text-sm text-white/70">Transmetimi nuk është i disponueshëm.</p>
          )}
        </div>
      </PlayerFrame>
    );
  }

  if (kind === 'unavailable' || kind === 'error' || !src || failed) {
    return (
      <PlayerFrame className={className}>
        <p className="px-4 text-center text-sm text-white/80" role="alert">
          {failed ? 'Videoja nuk u luajt.' : 'Videoja nuk është e disponueshme.'}
        </p>
      </PlayerFrame>
    );
  }

  const url = getFullUrl(src);
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black ${className}`}>
      {loading ? <p className="absolute left-3 top-3 z-10 text-xs text-white/80">Duke u ngarkuar…</p> : null}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        src={url}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        onLoadedData={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
    </div>
  );
}

function PlayerFrame({ children, className = '', poster }) {
  return (
    <div className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950 ${className}`}>
      {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" /> : null}
      {children}
    </div>
  );
}
