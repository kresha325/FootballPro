import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, scoutingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getFullUrl } from '../utils/mediaUrl';
import FeedScoutingReport from './FeedScoutingReport';
import { hasTier } from '../utils/subscriptionAccess';

const INITIAL_LIMIT = 20;
const PAGE_SIZE = 20;
const MAX_LIMIT = 100;

function PlayerAvatar({ player }) {
  const name = player.playerName || 'Lojtar';
  return player.profilePhoto ? (
    <img src={getFullUrl(player.profilePhoto)} alt={name} loading="lazy" className="xt-avatar h-12 w-12 object-cover" />
  ) : (
    <span className="xt-avatar h-12 w-12" aria-label={name}>{name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>
  );
}

function PlayerCard({ player, onAiSummary, aiLoading }) {
  const stats = player.stats && typeof player.stats === 'object' ? player.stats : {};
  const metrics = [
    ['Gola', stats.goals],
    ['Asiste', stats.assists],
    ['Ndeshje', stats.matches],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <article className="xt-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <PlayerAvatar player={player} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-[var(--xt-color-text)]">{player.playerName || 'Lojtar'}</h3>
          </div>
          <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">
            {[player.position, player.age != null ? `${player.age} vjeç` : null, player.club, player.nationality].filter(Boolean).join(' · ') || 'Të dhënat e identitetit nuk janë plotësuar'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{Number(player.score || 0).toFixed(1)}</div>
          <div className="text-[11px] text-[var(--xt-color-text-subtle)]">/{player.maxScore || 100} pikë</div>
        </div>
      </div>

      {metrics.length > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {metrics.map(([label, value]) => (
            <div className="rounded-md bg-[var(--xt-color-surface-raised)] px-3 py-2" key={label}>
              <dd className="text-base font-bold tabular-nums">{value}</dd>
              <dt className="text-xs text-[var(--xt-color-text-muted)]">{label}</dt>
            </div>
          ))}
        </dl>
      )}

      {Array.isArray(player.reasons) && player.reasons.length > 0 && (
        <p className="mt-3 line-clamp-2 text-sm text-[var(--xt-color-text-muted)]">{player.reasons.join(' · ')}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary flex-1 sm:flex-none" to={`/profile/${player.playerId}`}>Shiko profilin</Link>
        <button className="btn btn-outline" type="button" disabled={aiLoading} onClick={() => onAiSummary(player)}>
          {aiLoading ? 'Duke përgatitur…' : 'Raport AI'}
        </button>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-label="Po ngarkohen rekomandimet">
      {[0, 1, 2, 3].map((item) => <div className="xt-card space-y-4 p-5" key={item}><div className="flex gap-3"><div className="xt-skeleton h-12 w-12 rounded-full"/><div className="flex-1 space-y-2"><div className="xt-skeleton h-5 w-2/3"/><div className="xt-skeleton h-4 w-1/2"/></div></div><div className="xt-skeleton h-16 w-full"/><div className="xt-skeleton h-10 w-40"/></div>)}
    </div>
  );
}

const Scouting = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ position: '', minScore: '', minAge: '', maxAge: '', nationality: '', club: '', minGoals: '', minAssists: '', minMatches: '' });
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiError, setAiError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const authorized =
    ['scout', 'club'].includes(String(user?.role || '').toLowerCase()) && hasTier(user, 'pro');
  const serverFilters = useMemo(() => ({ position: filters.position, minScore: filters.minScore }), [filters.position, filters.minScore]);
  const loadRecommendations = useCallback(async (currentLimit, currentFilters, signal) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: currentLimit };
      if (currentFilters.position) params.position = currentFilters.position;
      if (currentFilters.minScore !== '') params.minScore = currentFilters.minScore;
      const response = await scoutingAPI.getRecommendations(params, { signal });
      if (signal.aborted) return;
      const data = response.data || {};
      const list = Array.isArray(data) ? data : Array.isArray(data.recommendations) ? data.recommendations : [];
      setRecommendations(list);
      setTotal(Number(data.total) || list.length);
    } catch (err) {
      if (!signal.aborted) {
        setRecommendations([]);
        setTotal(0);
        setError(err?.response?.data?.msg || 'Rekomandimet nuk u ngarkuan. Provo përsëri.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) loadRecommendations(limit, serverFilters, controller.signal);
    });
    return () => controller.abort();
  }, [authorized, limit, serverFilters, reloadKey, loadRecommendations]);

  const filteredRecommendations = useMemo(() => recommendations.filter((player) => {
    const age = Number(player.age);
    const stats = player.stats && typeof player.stats === 'object' ? player.stats : {};
    if (filters.minAge !== '' && (!Number.isFinite(age) || age < Number(filters.minAge))) return false;
    if (filters.maxAge !== '' && (!Number.isFinite(age) || age > Number(filters.maxAge))) return false;
    if (filters.nationality && !String(player.nationality || '').toLowerCase().includes(filters.nationality.toLowerCase())) return false;
    if (filters.club && !String(player.club || '').toLowerCase().includes(filters.club.toLowerCase())) return false;
    if (filters.minGoals !== '' && Number(stats.goals || 0) < Number(filters.minGoals)) return false;
    if (filters.minAssists !== '' && Number(stats.assists || 0) < Number(filters.minAssists)) return false;
    if (filters.minMatches !== '' && Number(stats.matches || 0) < Number(filters.minMatches)) return false;
    return true;
  }), [recommendations, filters]);

  const averageScore = useMemo(() => recommendations.length
    ? (recommendations.reduce((sum, player) => sum + (Number(player.score) || 0), 0) / recommendations.length).toFixed(1)
    : '—', [recommendations]);

  const updateFilter = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resetFilters = () => {
    setFilters({ position: '', minScore: '', minAge: '', maxAge: '', nationality: '', club: '', minGoals: '', minAssists: '', minMatches: '' });
    setLimit(INITIAL_LIMIT);
  };

  const fetchAiSummary = async (player) => {
    setAiLoadingId(player.playerId);
    setAiError('');
    try {
      const response = await aiAPI.scoutSummary(player.playerId);
      setAiSummary({ playerId: player.playerId, text: response.data.summary, name: response.data.playerName || player.playerName });
    } catch (err) {
      setAiError(err?.response?.data?.msg || err?.response?.data?.error || 'Raporti nuk u krijua. Provo përsëri.');
    } finally {
      setAiLoadingId(null);
    }
  };

  if (!authorized) {
    const roleOk = ['scout', 'club'].includes(String(user?.role || '').toLowerCase());
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="xt-card xt-empty-state">
          <h1 className="text-2xl font-bold">Qasja është e kufizuar</h1>
          <p>
            {roleOk
              ? 'Rekomandimet e scouting janë tipar Pro. Trial 30-ditor jep tipare Basic (analitikë, badge), jo Pro.'
              : 'Qendra e scouting është për role Scout/Club me planin Pro.'}
          </p>
          {roleOk ? (
            <Link to="/premium" className="btn btn-primary mt-6 inline-flex min-h-11 px-6">
              Përmirëso në Pro
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  const inputClass = 'input';

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:py-8">
      <header className="xt-page-header">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--xt-color-gold-bright)]">X TALENTI · RECRUITMENT</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Qendra e Scouting</h1>
        <p>Identifiko talentin dhe shqyrto rekomandimet sipas të dhënave të disponueshme.</p>
      </header>

      <section aria-label="Përmbledhje e scouting" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Kandidatë në rezultatet e ngarkuara', recommendations.length],
          ['Kandidatë që përputhen me filtrat', filteredRecommendations.length],
          ['Pikë mesatare e rekomandimit', averageScore],
        ].map(([label, value]) => <div className="xt-stat-card" key={label}><div className="text-2xl font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{value}</div><p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{label}</p></div>)}
      </section>

      <section className="xt-card p-4 sm:p-5">
        <div className="xt-section-header">
          <div><h2 className="text-xl font-semibold">Zbulimi i lojtarëve</h2><p className="mt-1 text-sm">Filtrat e moshës, shtetësisë, klubit dhe statistikave zbatohen mbi rezultatet e ngarkuara.</p></div>
          <button type="button" onClick={resetFilters} className="btn btn-quiet">Pastro filtrat</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <label><span className="label">Pozicioni</span><input className={inputClass} name="position" value={filters.position} onChange={updateFilter} placeholder="p.sh. Forward" /></label>
          <label><span className="label">Pikë minimale</span><input className={inputClass} type="number" min="0" max="100" name="minScore" value={filters.minScore} onChange={updateFilter} placeholder="0" /></label>
          <label><span className="label">Mosha nga</span><input className={inputClass} type="number" min="0" max="100" name="minAge" value={filters.minAge} onChange={updateFilter} placeholder="Çdo moshë" /></label>
          <label><span className="label">Mosha deri</span><input className={inputClass} type="number" min="0" max="100" name="maxAge" value={filters.maxAge} onChange={updateFilter} placeholder="Çdo moshë" /></label>
          <label><span className="label">Shtetësia</span><input className={inputClass} name="nationality" value={filters.nationality} onChange={updateFilter} placeholder="Kërko shtetësi" /></label>
          <label><span className="label">Klubi</span><input className={inputClass} name="club" value={filters.club} onChange={updateFilter} placeholder="Kërko klub" /></label>
          <label><span className="label">Gola minimum</span><input className={inputClass} type="number" min="0" name="minGoals" value={filters.minGoals} onChange={updateFilter} placeholder="—" /></label>
          <label><span className="label">Asiste minimum</span><input className={inputClass} type="number" min="0" name="minAssists" value={filters.minAssists} onChange={updateFilter} placeholder="—" /></label>
          <label><span className="label">Ndeshje minimum</span><input className={inputClass} type="number" min="0" name="minMatches" value={filters.minMatches} onChange={updateFilter} placeholder="—" /></label>
        </div>
      </section>

      {aiSummary && (
        <section className="xt-card border-[var(--xt-color-gold)] p-4 sm:p-5" aria-live="polite">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--xt-color-gold-bright)]">Raport AI · {aiSummary.name}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{aiSummary.text}</p></div><button type="button" className="btn btn-quiet shrink-0" onClick={() => setAiSummary(null)}>Mbyll</button></div>
        </section>
      )}
      {aiError && <p className="xt-error-state rounded-lg border border-[var(--xt-color-danger)]/40 bg-[var(--xt-color-surface)] p-3 text-sm" role="alert">{aiError}</p>}

      <section className="space-y-4" aria-labelledby="recommended-title">
        <div className="xt-section-header mb-0"><div><h2 id="recommended-title" className="text-xl font-semibold">Rekomandime</h2><p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{filteredRecommendations.length} rezultate të filtruara · {total} rekomandime sipas pozicionit dhe pikëve.</p></div>{recommendations.length > 0 && <span className="xt-badge xt-badge-gold">Renditur sipas pikëve</span>}</div>
        {loading ? <LoadingState /> : error ? (
          <div className="xt-error-state xt-card" role="alert"><p>{error}</p><button type="button" className="btn btn-outline" onClick={() => setReloadKey((current) => current + 1)}>Provo përsëri</button></div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="xt-empty-state xt-card"><h3 className="font-semibold text-[var(--xt-color-text)]">Nuk u gjetën lojtarë</h3><p>{recommendations.length ? 'Ndrysho filtrat për të parë kandidatë të tjerë.' : 'Nuk ka rekomandime me kriteret aktuale.'}</p><button type="button" className="btn btn-outline" onClick={resetFilters}>Pastro filtrat</button></div>
        ) : (
          <>
            <div className="xt-card xt-table-wrap hidden overflow-hidden lg:block">
              <table className="xt-table min-w-[860px]">
                <thead><tr><th>Lojtari</th><th>Pozicioni</th><th>Mosha</th><th>Klubi</th><th>Gola / Asiste</th><th>Pikë</th><th>Veprime</th></tr></thead>
                <tbody>{filteredRecommendations.map((player) => (
                  <tr key={player.playerId}>
                    <td><Link to={`/profile/${player.playerId}`} className="flex items-center gap-3 font-semibold text-[var(--xt-color-text)] hover:text-[var(--xt-color-gold-bright)]"><PlayerAvatar player={player}/><span>{player.playerName || 'Lojtar'}{player.nationality && <span className="mt-1 block text-xs font-normal text-[var(--xt-color-text-muted)]">{player.nationality}</span>}</span></Link></td>
                    <td>{player.position || '—'}</td>
                    <td>{player.age != null ? `${player.age} vjeç` : '—'}</td>
                    <td>{player.club || '—'}</td>
                    <td>{[player.stats?.goals != null ? `${player.stats.goals} G` : null, player.stats?.assists != null ? `${player.stats.assists} A` : null].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{Number(player.score || 0).toFixed(1)}</td>
                    <td><button type="button" className="btn btn-outline min-h-9 px-3 py-1 text-sm" disabled={aiLoadingId === player.playerId} onClick={() => fetchAiSummary(player)}>{aiLoadingId === player.playerId ? 'Po krijohet…' : 'Raport AI'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:hidden">
              {filteredRecommendations.map((player) => <PlayerCard key={player.playerId} player={player} onAiSummary={fetchAiSummary} aiLoading={aiLoadingId === player.playerId} />)}
            </div>
            {recommendations.length >= limit && limit < MAX_LIMIT && (
              <div className="flex justify-center"><button type="button" className="btn btn-outline" disabled={loading} onClick={() => setLimit((current) => Math.min(current + PAGE_SIZE, MAX_LIMIT))}>Ngarko më shumë kandidatë</button></div>
            )}
          </>
        )}
      </section>

      <FeedScoutingReport />
    </main>
  );
};

export default Scouting;
