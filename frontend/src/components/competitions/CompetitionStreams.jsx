import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { streamsAPI } from '../../services/api';

export default function CompetitionStreams({ tournamentId }) {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!tournamentId) return undefined;
    streamsAPI.getStreams({ tournamentId, limit: 6 })
      .then((res) => {
        if (!cancelled) setStreams(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setStreams([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  if (!loading && streams.length === 0) return null;

  return (
    <section className="xt-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Transmetimet</h2>
        <Link className="text-sm font-semibold" to={`/live?tournament=${tournamentId}`}>Të gjitha</Link>
      </div>
      {loading ? <p className="text-sm text-[var(--xt-color-text-muted)]">Duke ngarkuar…</p> : null}
      <ul className="space-y-2 text-sm">
        {streams.map((stream) => (
          <li key={stream.id}>
            <Link to={`/live/${stream.id}`} className="font-medium">
              {stream.isLive ? 'LIVE NOW' : stream.videoUrl ? 'WATCH REPLAY' : 'UPCOMING'} · {stream.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
