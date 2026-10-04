import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API, { extractApiMessage } from '../../services/api';

const VIEWS = [
  { id: 'upcoming', label: 'Në vijim' },
  { id: 'today', label: 'Sot' },
  { id: 'week', label: 'Kjo javë' },
  { id: 'completed', label: 'Përfunduara' },
];

function StateBlock({ title, body, action }) {
  return (
    <div className="xt-card p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">{body}</p>
      {action}
    </div>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState('upcoming');
  const [filters, setFilters] = useState({ competitionId: '', season: '', clubId: '', playerId: '', date: '', status: '' });
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setUnauthorized(false);
    const params = { view };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    API.get('/calendar', { params })
      .then((res) => {
        if (!cancelled) setMatches(Array.isArray(res.data?.matches) ? res.data.matches : []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) setUnauthorized(true);
        else setError(extractApiMessage(err, 'Kalendari nuk u ngarkua.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, filters]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--xt-color-text)]">Kalendari i ndeshjeve</h1>
          <p className="text-sm text-[var(--xt-color-text-muted)]">I njëjti burim për gara, ekipe dhe lojtarë.</p>
        </div>
        <Link to="/competitions" className="btn btn-quiet">Garat</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {VIEWS.map((item) => (
          <button key={item.id} type="button" className={`btn btn-quiet ${view === item.id ? 'border-[var(--xt-color-gold)]' : ''}`} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="xt-card grid gap-3 p-4 md:grid-cols-3">
        {[
          ['competitionId', 'ID e garës'],
          ['season', 'Sezoni'],
          ['clubId', 'ID e ekipit'],
          ['playerId', 'ID e lojtarit'],
          ['date', 'Data'],
          ['status', 'Statusi'],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block text-[var(--xt-color-text-subtle)]">{label}</span>
            <input
              className="w-full rounded-lg border border-[var(--xt-color-border)] bg-transparent px-3 py-2"
              type={key === 'date' ? 'date' : 'text'}
              value={filters[key]}
              onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      {loading && <StateBlock title="Duke ngarkuar" body="Po filtrojmë kalendarin." />}
      {unauthorized && <StateBlock title="Duhet hyrje" body="Kalendari publik nuk kërkon hyrje. Nëse e sheh këtë, provo përsëri." action={<Link to="/login" className="btn btn-primary mt-4">Hyr</Link>} />}
      {error && <StateBlock title="Kalendari dështoi" body={error} action={<button type="button" className="btn btn-primary mt-4" onClick={() => setFilters((prev) => ({ ...prev }))}>Provo përsëri</button>} />}
      {!loading && !error && !unauthorized && matches.length === 0 && (
        <StateBlock title="Asnjë ndeshje" body="Nuk ka ndeshje për këtë pamje dhe filtra." />
      )}
      {!loading && !error && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match) => (
            <Link key={match.id} to={match.publicPath || `/matches/${match.id}`} className="xt-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-[var(--xt-color-text)]">{match.homeName || 'Vendas'} vs {match.awayName || 'Mysafir'}</p>
                <p className="text-sm text-[var(--xt-color-text-muted)]">
                  {match.Tournament?.name || 'Garë'} {match.Tournament?.season ? `· ${match.Tournament.season}` : ''} · {match.status}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{match.scoreHome ?? '–'} : {match.scoreAway ?? '–'}</p>
                <p className="text-[var(--xt-color-text-subtle)]">{match.matchDate ? new Date(match.matchDate).toLocaleString() : 'Pa orar'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
