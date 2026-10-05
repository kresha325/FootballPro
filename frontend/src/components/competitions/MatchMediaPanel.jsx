import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaAPI, streamsAPI } from '../../services/api';
import MediaPlayer from '../media/MediaPlayer';
import MediaSection from '../media/MediaSection';

function labelFor(stream) {
  if (stream?.isLive || stream?.status === 'live') return 'LIVE NOW';
  if (stream?.videoUrl || stream?.status === 'available') return 'WATCH REPLAY';
  if (stream?.status === 'processing') return 'PROCESSING';
  if (stream?.status === 'scheduled') return 'UPCOMING';
  return null;
}

export default function MatchMediaPanel({ matchId }) {
  const [streams, setStreams] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!matchId) return undefined;
    setLoading(true);
    Promise.all([
      streamsAPI.getStreams({ matchId, limit: 8 }).then((res) => (Array.isArray(res.data) ? res.data : [])).catch(() => []),
      mediaAPI.listMatch(matchId, { limit: 8 }).then((res) => res.data?.items || []).catch(() => []),
    ]).then(([streamRows, mediaRows]) => {
      if (cancelled) return;
      setStreams(streamRows);
      setHighlights(mediaRows);
      setError('');
    }).catch(() => {
      if (!cancelled) setError('Media e ndeshjes nuk u ngarkua.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const primary = streams.find((row) => row.isLive) || streams.find((row) => row.videoUrl) || streams[0];
  const badge = primary ? labelFor(primary) : (highlights.length ? 'HIGHLIGHTS' : null);

  return (
    <section className="xt-card space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Video</h2>
        {badge ? <span className="xt-badge">{badge}</span> : null}
      </div>
      {loading ? <p className="text-sm text-[var(--xt-color-text-muted)]">Duke ngarkuar videon e ndeshjes…</p> : null}
      {error ? <p className="text-sm text-[var(--xt-color-danger,#b91c1c)]" role="alert">{error}</p> : null}
      {!loading && !primary && highlights.length === 0 ? (
        <p className="text-sm text-[var(--xt-color-text-muted)]">Nuk ka live, replay apo highlights për këtë ndeshje. Statistikat mbeten të pavarura nga videoja.</p>
      ) : null}
      {primary ? (
        <div className="space-y-2">
          <MediaPlayer
            kind={primary.isLive ? 'live' : (primary.videoUrl ? 'replay' : 'unavailable')}
            src={primary.videoUrl}
            title={primary.title}
            poster={primary.thumbnailUrl}
            streamId={primary.id}
            status={labelFor(primary)}
          />
          <p className="text-sm text-[var(--xt-color-text-muted)]">{primary.title}</p>
          {primary.isLive ? <Link className="text-sm font-semibold text-[var(--xt-color-gold,#9A6B12)]" to={`/live/${primary.id}`}>Hap transmetimin</Link> : null}
        </div>
      ) : null}
      <MediaSection context="match" entityId={matchId} title="Highlights" categoryFilter="match_highlight,goal,assist,save,skills,tackle" />
    </section>
  );
}
