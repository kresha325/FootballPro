import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API, { extractApiMessage } from '../../services/api';
import CompetitionStreams from './CompetitionStreams';
import { useAuth } from '../../contexts/AuthContext';

const SECTIONS = [
  { id: 'overview', label: 'Përmbledhje' },
  { id: 'standings', label: 'Tabela' },
  { id: 'fixtures', label: 'Ndeshjet' },
  { id: 'bracket', label: 'Bracket' },
];

function StateBlock({ title, body, action }) {
  return (
    <div className="xt-card p-8 text-center">
      <h2 className="text-lg font-semibold text-[var(--xt-color-text)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">{body}</p>
      {action}
    </div>
  );
}

function teamName(user) {
  if (!user) return '—';
  const club = user.Profile?.club;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || club || `Ekipi #${user.id || ''}`;
}

function lifecycleLabel(value) {
  const map = {
    draft: 'Draft',
    registration: 'Regjistrim',
    open: 'Regjistrim',
    active: 'Aktiv',
    in_progress: 'Në zhvillim',
    ongoing: 'Në zhvillim',
    completed: 'Përfunduar',
    finished: 'Përfunduar',
    cancelled: 'Anuluar',
  };
  return map[value] || value || '—';
}

export default function CompetitionCenter({ section = 'overview' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [standings, setStandings] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [bracket, setBracket] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setUnauthorized(false);
      setMissing(false);
      try {
        if (!id) {
          const res = await API.get('/tournaments');
          if (!cancelled) setList(Array.isArray(res.data) ? res.data : []);
          return;
        }
        const [compRes, standingsRes, fixtureRes, bracketRes, statsRes] = await Promise.all([
          API.get(`/tournaments/${id}`),
          API.get(`/tournaments/${id}/standings`),
          API.get(`/tournaments/${id}/matches`),
          API.get(`/tournaments/${id}/bracket`),
          API.get(`/tournaments/${id}/player-stats`),
        ]);
        if (cancelled) return;
        setCompetition(compRes.data);
        setStandings(standingsRes.data);
        setFixtures(Array.isArray(fixtureRes.data) ? fixtureRes.data : []);
        setBracket(bracketRes.data || {});
        setPlayers(statsRes.data?.players || []);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) setUnauthorized(true);
        else if (err?.response?.status === 404) setMissing(true);
        else setError(extractApiMessage(err, 'Garat nuk u ngarkuan.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function startCompetition() {
    setBusy(true);
    try {
      await API.post(`/tournaments/${id}/start`, {});
      window.location.reload();
    } catch (err) {
      setError(extractApiMessage(err, 'Gara nuk nisi.'));
    } finally {
      setBusy(false);
    }
  }

  async function joinCompetition() {
    setBusy(true);
    try {
      await API.post(`/tournaments/${id}/join`, {});
      window.location.reload();
    } catch (err) {
      setError(extractApiMessage(err, 'Regjistrimi dështoi.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <StateBlock title="Duke ngarkuar" body="Po marrim garat, tabelën dhe ndeshjet." />;
  }
  if (unauthorized) {
    return (
      <StateBlock
        title="Duhet hyrje"
        body="Ky veprim kërkon një llogari. Shikimi publik i garave është i hapur; provo përsëri ose hyr."
        action={<Link to="/login" className="btn btn-primary mt-4">Hyr</Link>}
      />
    );
  }
  if (error) {
    return (
      <StateBlock
        title="Nuk u ngarkua"
        body={error}
        action={<button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Provo përsëri</button>}
      />
    );
  }
  if (missing) {
    return <StateBlock title="Gara nuk u gjet" body="Kjo lidhje nuk i përgjigjet një gare." />;
  }

  if (!id) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--xt-color-text)]">Garat</h1>
            <p className="text-sm text-[var(--xt-color-text-muted)]">Ligë, kupa, grupe dhe turne nga të dhënat zyrtare.</p>
          </div>
          <Link to="/calendar" className="btn btn-quiet">Kalendari</Link>
        </div>
        {list.length === 0 ? (
          <StateBlock title="Ende pa gara" body="Kur një ligë, klub ose scout krijon një garë, ajo shfaqet këtu." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((item) => (
              <Link key={item.id} to={`/competitions/${item.id}`} className="xt-card block p-4 hover:bg-[var(--xt-color-surface-hover)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[var(--xt-color-text)]">{item.name}</h2>
                    <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">
                      {(item.type || '').replaceAll('_', ' ')} · {item.season || 'Pa sezon'} · {item.city || item.country || 'Pa vend'}
                    </p>
                  </div>
                  <span className="xt-badge">{lifecycleLabel(item.lifecycle || item.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const lifecycle = competition?.lifecycle || competition?.status;
  const isCreator = user && Number(competition?.creatorId) === Number(user.id);
  const rows = standings?.rows || [];
  const bracketRounds = bracket && typeof bracket === 'object' ? Object.keys(bracket) : [];

  return (
    <div className="space-y-4 py-4">
      <div className="xt-card p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--xt-color-text-subtle)]">
              {competition?.type} · {competition?.season || 'Sezon'}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--xt-color-text)]">{competition?.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--xt-color-text-muted)]">
              {competition?.description || 'Pa përshkrim.'}
            </p>
            <p className="mt-2 text-sm text-[var(--xt-color-text-muted)]">
              {competition?.organizer ? `${competition.organizer} · ` : ''}
              {[competition?.city, competition?.country].filter(Boolean).join(', ') || 'Vend i papërcaktuar'}
              {competition?.gender ? ` · ${competition.gender}` : ''}
            </p>
          </div>
          <span className="xt-badge">{lifecycleLabel(lifecycle)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user && lifecycle === 'registration' && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={joinCompetition}>Regjistrohu</button>
          )}
          {isCreator && lifecycle === 'registration' && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={startCompetition}>Gjenero ndeshjet dhe nise</button>
          )}
          {!user && <Link to="/login" className="btn btn-quiet">Hyr për t'u regjistruar</Link>}
          <Link to="/calendar" className="btn btn-quiet">Kalendari</Link>
        </div>
        {error && <p className="mt-3 text-sm text-[var(--xt-color-danger)]">{error}</p>}
      </div>
      {id ? <CompetitionStreams tournamentId={id} /> : null}

      <nav className="flex gap-2 overflow-x-auto">
        {SECTIONS.map((item) => (
          <Link
            key={item.id}
            to={item.id === 'overview' ? `/competitions/${id}` : `/competitions/${id}/${item.id}`}
            className={`btn btn-quiet whitespace-nowrap ${section === item.id ? 'border-[var(--xt-color-gold)]' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {section === 'overview' && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="xt-card p-4"><p className="text-xs text-[var(--xt-color-text-subtle)]">Ekipe</p><p className="text-2xl font-semibold">{competition?.participants?.length || 0}</p></div>
          <div className="xt-card p-4"><p className="text-xs text-[var(--xt-color-text-subtle)]">Ndeshje</p><p className="text-2xl font-semibold">{fixtures.length}</p></div>
          <div className="xt-card p-4"><p className="text-xs text-[var(--xt-color-text-subtle)]">Golashënuesit</p><p className="text-2xl font-semibold">{players.length}</p></div>
          <div className="xt-card p-4 md:col-span-3">
            <h2 className="mb-3 font-semibold">Renditja</h2>
            <StandingsTable rows={rows.slice(0, 8)} />
            {players.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">Statistikat e lojtarëve</h3>
                <PlayerTable players={players.slice(0, 8)} />
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'standings' && (
        <div className="space-y-4">
          <div className="xt-card p-4">
            <p className="mb-3 text-sm text-[var(--xt-color-text-muted)]">{standings?.caption}</p>
            {rows.length === 0 ? <StateBlock title="Tabela është bosh" body="Pikët shfaqen pasi ndeshjet përfundojnë." /> : <StandingsTable rows={rows} />}
          </div>
          {standings?.groups && Object.entries(standings.groups).map(([group, groupRows]) => (
            <div key={group} className="xt-card p-4">
              <h2 className="mb-3 font-semibold">Grupi {group}</h2>
              <StandingsTable rows={groupRows} />
            </div>
          ))}
        </div>
      )}

      {section === 'fixtures' && (
        <div className="xt-card p-4">
          {fixtures.length === 0 ? (
            <StateBlock title="Nuk ka ndeshje" body="Gjenero fiksimet kur gara është gati për nisje." />
          ) : (
            <FixtureList fixtures={fixtures} />
          )}
        </div>
      )}

      {section === 'bracket' && (
        <div className="xt-card p-4">
          {bracketRounds.length === 0 ? (
            <StateBlock title="Nuk ka bracket" body="Bracket-i krijohet për kupa dhe nokaut, dhe për raundet pas grupeve." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bracketRounds.map((round) => (
                <div key={round}>
                  <h2 className="mb-2 font-semibold">Raundi {round}</h2>
                  <div className="space-y-2">
                    {(bracket[round] || []).map((slot) => (
                      <Link key={slot.id || slot.matchId} to={`/matches/${slot.matchId || slot.Match?.id}`} className="block rounded-lg border border-[var(--xt-color-border)] p-3 text-sm">
                        <span>{teamName(slot.Match?.homeUser)} {slot.Match?.scoreHome ?? '–'} : {slot.Match?.scoreAway ?? '–'} {teamName(slot.Match?.awayUser)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StandingsTable({ rows }) {
  if (!rows?.length) return <p className="text-sm text-[var(--xt-color-text-muted)]">Nuk ka të dhëna.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[var(--xt-color-text-subtle)]">
          <tr>
            {['#', 'Ekipi', 'N', 'F', 'B', 'H', 'GF', 'GA', 'DG', 'P'].map((head) => (
              <th key={head} className="px-2 py-2 font-medium">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-t border-[var(--xt-color-border)]">
              <td className="px-2 py-2">{row.rank}</td>
              <td className="px-2 py-2 font-medium">{teamName(row.User)}{row.groupName ? ` (${row.groupName})` : ''}</td>
              <td className="px-2 py-2">{row.played}</td>
              <td className="px-2 py-2">{row.wins}</td>
              <td className="px-2 py-2">{row.draws}</td>
              <td className="px-2 py-2">{row.losses}</td>
              <td className="px-2 py-2">{row.goalsFor}</td>
              <td className="px-2 py-2">{row.goalsAgainst}</td>
              <td className="px-2 py-2">{row.goalDifference}</td>
              <td className="px-2 py-2 font-semibold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FixtureList({ fixtures }) {
  return (
    <div className="space-y-2">
      {fixtures.map((match) => (
        <Link key={match.id} to={`/matches/${match.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--xt-color-border)] p-3 text-sm">
          <span className="font-medium">{teamName(match.homeUser)} vs {teamName(match.awayUser) || 'Bye'}</span>
          <span>{match.scoreHome ?? '–'} : {match.scoreAway ?? '–'}</span>
          <span className="text-[var(--xt-color-text-subtle)]">
            {match.roundLabel || (match.groupName ? `Grupi ${match.groupName}` : `R${match.round || 1}`)} · {match.status}
            {match.matchDate ? ` · ${new Date(match.matchDate).toLocaleString()}` : ''}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PlayerTable({ players }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-[var(--xt-color-text-subtle)]">
          <tr>
            {['Lojtari', 'Ndeshje', 'Min', 'Gola', 'Asist', 'Verdha', 'Kuqe'].map((head) => (
              <th key={head} className="px-2 py-2 font-medium">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.userId} className="border-t border-[var(--xt-color-border)]">
              <td className="px-2 py-2">{player.name || `#${player.userId}`}</td>
              <td className="px-2 py-2">{player.appearances}</td>
              <td className="px-2 py-2">{player.minutes}</td>
              <td className="px-2 py-2">{player.goals}</td>
              <td className="px-2 py-2">{player.assists}</td>
              <td className="px-2 py-2">{player.yellowCards}</td>
              <td className="px-2 py-2">{player.redCards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
