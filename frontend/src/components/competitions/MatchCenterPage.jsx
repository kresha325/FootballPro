import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API, { extractApiMessage } from '../../services/api';
import MatchMediaPanel from './MatchMediaPanel';

function StateBlock({ title, body, action }) {
  return (
    <div className="xt-card mx-auto mt-6 max-w-3xl p-8 text-center">
      <h2 className="text-lg font-semibold text-[var(--xt-color-text)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">{body}</p>
      {action}
    </div>
  );
}

function personName(user, fallbackId) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || (fallbackId ? `#${fallbackId}` : '—');
}

function sideName(match, side) {
  const user = side === 'home' ? match.homeUser : match.awayUser;
  const fallback = side === 'home' ? match.homeName : match.awayName;
  if (!user && !fallback) return side === 'away' && !match.awayUserId ? 'Bye' : '—';
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.Profile?.club || fallback || '—';
}

export default function MatchCenterPage() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get(`/matches/${id}`)
      .then((res) => {
        if (!cancelled) setMatch(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setMissing(true);
        else if (err?.response?.status === 401) setUnauthorized(true);
        else setError(extractApiMessage(err, 'Ndeshja nuk u ngarkua.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <StateBlock title="Duke ngarkuar ndeshjen" body="Po hapim qendrën e ndeshjes." />;
  if (unauthorized) {
    return <StateBlock title="Duhet hyrje" body="Kjo faqe kërkon autorizim." action={<Link to="/login" className="btn btn-primary mt-4">Hyr</Link>} />;
  }
  if (missing) return <StateBlock title="Ndeshja nuk u gjet" body="Kontrollo lidhjen e ndeshjes." />;
  if (error) {
    return <StateBlock title="Gabim" body={error} action={<button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Provo përsëri</button>} />;
  }
  if (!match) return <StateBlock title="Nuk ka të dhëna" body="Ndeshja nuk ka përmbajtje." />;

  const events = [...(match.events || [])].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  const scorers = match.MatchScorers || [];
  const stats = match.playerStats || [];
  const competitionId = match.competition?.id || match.tournamentId;

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-4">
      <div className="xt-card p-4 md:p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--xt-color-text-subtle)]">
          {match.competition?.name || 'Ndeshje'} · {match.roundLabel || match.groupName || `Raundi ${match.round || 1}`}
        </p>
        <div className="mt-4 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div>
            <h1 className="text-xl font-semibold text-[var(--xt-color-text)]">{sideName(match, 'home')}</h1>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-[var(--xt-color-text)]">{match.scoreHome ?? '–'} : {match.scoreAway ?? '–'}</p>
            <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">
              {match.clockPhase || match.status}
              {match.clockMinute != null ? ` · ${match.clockMinute}'` : ''}
            </p>
            {(match.penaltiesHome != null || match.penaltiesAway != null) && (
              <p className="text-sm text-[var(--xt-color-text-muted)]">Penallti {match.penaltiesHome} : {match.penaltiesAway}</p>
            )}
          </div>
          <div className="md:text-right">
            <h2 className="text-xl font-semibold text-[var(--xt-color-text)]">{sideName(match, 'away')}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm text-[var(--xt-color-text-muted)]">
          {match.matchDate ? new Date(match.matchDate).toLocaleString() : 'Pa orar'}
          {' · '}
          {match.venue || match.Stadium?.name || 'Pa stadium'}
          {match.refereeName ? ` · Gjyqtar: ${match.refereeName}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {competitionId && <Link className="btn btn-quiet" to={`/competitions/${competitionId}`}>Gara</Link>}
          {competitionId && <Link className="btn btn-quiet" to={`/competitions/${competitionId}/standings`}>Tabela</Link>}
          <Link className="btn btn-quiet" to="/calendar">Kalendari</Link>
          {match.highlightsUrl && <a className="btn btn-primary" href={match.highlightsUrl}>Highlights</a>}
        </div>
      </div>

      <MatchMediaPanel matchId={match.id} />

      <div className="grid gap-3 md:grid-cols-2">
        <section className="xt-card p-4">
          <h2 className="mb-3 font-semibold">Ngjarjet</h2>
          {events.length === 0 && scorers.length === 0 ? (
            <p className="text-sm text-[var(--xt-color-text-muted)]">Ende pa gola, kartona apo ndërrime.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scorers.map((row) => (
                <li key={`s-${row.id}`}>Gol · {personName(row.User, row.userId)} {row.minute != null ? `${row.minute}'` : ''} {row.side || ''}</li>
              ))}
              {events.map((event) => (
                <li key={event.id}>
                  {event.minute != null ? `${event.minute}' ` : ''}
                  {String(event.type || '').replaceAll('_', ' ')}
                  {event.userId ? ` · ${personName(event.player, event.userId)}` : ''}
                  {event.relatedUserId ? ` → #${event.relatedUserId}` : ''}
                  {event.detail ? ` · ${event.detail}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="xt-card p-4">
          <h2 className="mb-3 font-semibold">Formacioni</h2>
          {match.lineup?.home?.length || match.lineup?.away?.length ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-medium">Vendas</p>
                <p>{(match.lineup.home || []).map((pid) => `#${pid}`).join(', ') || '—'}</p>
              </div>
              <div>
                <p className="font-medium">Mysafir</p>
                <p>{(match.lineup.away || []).map((pid) => `#${pid}`).join(', ') || '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--xt-color-text-muted)]">Formacioni publikohet kur skuadra e dorëzon.</p>
          )}
          {(match.halfTimeHome != null || match.halfTimeAway != null) && (
            <p className="mt-3 text-sm text-[var(--xt-color-text-muted)]">Pjesa e parë {match.halfTimeHome} : {match.halfTimeAway}</p>
          )}
        </section>
      </div>

      <section className="xt-card p-4">
        <h2 className="mb-3 font-semibold">Statistikat e lojtarëve</h2>
        {stats.length === 0 ? (
          <p className="text-sm text-[var(--xt-color-text-muted)]">Statistikat individuale shfaqen pasi regjistrohen nga organizatori.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-[var(--xt-color-text-subtle)]">
                <tr>
                  {['Lojtari', 'Min', 'Gola', 'Asist', 'Goditje', 'Në portë', 'Pasime', 'Verdha', 'Kuqe', 'Pritje', 'Nota'].map((head) => (
                    <th key={head} className="px-2 py-2 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.id || row.userId} className="border-t border-[var(--xt-color-border)]">
                    <td className="px-2 py-2">{personName(row.player, row.userId)}</td>
                    <td className="px-2 py-2">{row.minutes}</td>
                    <td className="px-2 py-2">{row.goals}</td>
                    <td className="px-2 py-2">{row.assists}</td>
                    <td className="px-2 py-2">{row.shots}</td>
                    <td className="px-2 py-2">{row.shotsOnTarget}</td>
                    <td className="px-2 py-2">{row.passes}</td>
                    <td className="px-2 py-2">{row.yellowCards}</td>
                    <td className="px-2 py-2">{row.redCards}</td>
                    <td className="px-2 py-2">{row.saves}</td>
                    <td className="px-2 py-2">{row.rating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
