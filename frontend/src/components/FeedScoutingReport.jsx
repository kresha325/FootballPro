import { useEffect, useMemo, useState } from 'react';
import { scoutingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AGE_GROUP_OPTIONS, metricLabel, scoreTone, winnerForMetric } from '../utils/scoutingScore';
import PersonName from './PersonName';

function avatarOrFallback(url) {
  if (!url) return '/default-avatar.svg';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
}

const METRICS = ['goals', 'assists', 'likes', 'followers'];
const SCOUTING_REPORT_ROLES = new Set(['federation', 'scout', 'manager', 'club']);

const FeedScoutingReport = () => {
  const { user } = useAuth();
  const canUseReport = SCOUTING_REPORT_ROLES.has(String(user?.role || '').toLowerCase());

  const [ageGroup, setAgeGroup] = useState('all');
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [error, setError] = useState('');

  const canCompare = Boolean(playerAId && playerBId && playerAId !== playerBId);

  const candidateMap = useMemo(() => {
    const map = new Map();
    candidates.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [candidates]);

  useEffect(() => {
    if (!canUseReport) {
      setLoadingCandidates(false);
      return undefined;
    }
    let cancelled = false;

    const loadCandidates = async () => {
      setLoadingCandidates(true);
      setError('');
      try {
        const params = { source: 'followers' };
        if (ageGroup !== 'all') params.ageGroup = ageGroup;
        const res = await scoutingAPI.getCandidates(params);
        if (cancelled) return;
        const list = Array.isArray(res.data?.candidates) ? res.data.candidates : [];
        setCandidates(list);

        if (!list.some((p) => String(p.id) === String(playerAId))) {
          setPlayerAId(list[0] ? String(list[0].id) : '');
        }
        if (!list.some((p) => String(p.id) === String(playerBId))) {
          setPlayerBId(list[1] ? String(list[1].id) : (list[0] ? String(list[0].id) : ''));
        }
        setCompareData(null);
      } catch (err) {
        if (!cancelled) {
          setCandidates([]);
          setCompareData(null);
          setError(err?.response?.data?.msg || 'Scouting candidates failed to load.');
        }
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    };

    loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [ageGroup, canUseReport]);

  if (!canUseReport) return null;

  const runCompare = async () => {
    if (!canCompare) return;
    setComparing(true);
    setError('');
    try {
      const params = { playerAId, playerBId, source: 'followers' };
      if (ageGroup !== 'all') params.ageGroup = ageGroup;
      const res = await scoutingAPI.comparePlayers(params);
      setCompareData(res.data || null);
    } catch (err) {
      setCompareData(null);
      setError(err?.response?.data?.msg || 'Scouting comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  const playerA = candidateMap.get(String(playerAId));
  const playerB = candidateMap.get(String(playerBId));

  return (
    <section className="xt-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--xt-color-text)] md:text-xl">Krahasimi i lojtarëve</h2>
          <p className="text-sm text-[var(--xt-color-text-muted)]">
            Krahaso dy atletë të ndjekur sipas golave, asistimeve, pëlqimeve dhe ndjekësve.
          </p>
        </div>
        <select
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          className="select w-full sm:w-auto"
        >
              {AGE_GROUP_OPTIONS.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </div>

      {loadingCandidates ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="xt-skeleton h-24 rounded-lg" />
          <div className="xt-skeleton h-24 rounded-lg" />
          <div className="xt-skeleton h-24 rounded-lg" />
        </div>
      ) : candidates.length < 2 ? (
        <div className="xt-empty-state rounded-lg border border-dashed border-[var(--xt-color-border-strong)] p-4 text-sm">
          Të duhen të paktën 2 atletë të ndjekur në këtë grupmoshë për të gjeneruar krahasimin.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[{ label: 'Player A', value: playerAId, onChange: setPlayerAId }, { label: 'Player B', value: playerBId, onChange: setPlayerBId }].map((slot) => (
              <div key={slot.label} className="rounded-lg border border-[var(--xt-color-border)] p-3">
                <label className="label">{slot.label}</label>
                <select
                  value={slot.value}
                  onChange={(e) => slot.onChange(e.target.value)}
                  className="select mt-2"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id} translate="no" className="notranslate">
                      {c.fullName} {c.position ? `· ${c.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="xt-card sticky bottom-20 flex flex-col justify-end p-3 lg:static">
              <button
                type="button"
                onClick={runCompare}
                disabled={!canCompare || comparing}
                className="btn btn-primary w-full"
              >
                  {comparing ? 'Duke krahasuar...' : 'Krahaso Lojtarët'}
              </button>
            </div>
          </div>

          {(playerA || playerB) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{ label: 'A', player: playerA }, { label: 'B', player: playerB }].map((item) => (
                <div key={item.label} className="rounded-lg border border-[var(--xt-color-border)] p-3 flex items-center gap-3">
                  <img
                    src={avatarOrFallback(item.player?.profilePhoto)}
                    alt={item.player?.fullName || `Player ${item.label}`}
                    className="xt-avatar h-12 w-12 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--xt-color-text)]">
                      <PersonName>{item.player?.fullName || '-'}</PersonName>
                    </p>
                    <p className="truncate text-xs text-[var(--xt-color-text-muted)]">
                      {item.player?.position || 'Pa pozicion'} {item.player?.club ? `· ${item.player.club}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error ? (
        <p className="xt-error-state mt-3 text-sm" role="alert">{error}</p>
      ) : null}

      {compareData?.players?.A && compareData?.players?.B ? (
        <div className="xt-card mt-4 p-3 md:p-4">
          <div className="grid grid-cols-3 items-center gap-2 mb-3">
            <div className="text-center">
              <p className="text-xs text-slate-500">Lojtari A</p>
              <p className={`text-2xl font-bold ${scoreTone(compareData.players.A.score)}`}>{compareData.players.A.score}</p>
            </div>
            <div className="text-center text-xs uppercase tracking-wide text-slate-500">
              {compareData.comparison?.winner === 'draw' ? 'Barazim' : `${compareData.comparison?.winner} fiton`}
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Lojtari B</p>
              <p className={`text-2xl font-bold ${scoreTone(compareData.players.B.score)}`}>{compareData.players.B.score}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[520px] md:min-w-0 grid grid-cols-4 gap-2">
              {METRICS.map((metric) => {
                const resultA = winnerForMetric(compareData.comparison?.metricWinners, metric, 'A');
                const resultB = winnerForMetric(compareData.comparison?.metricWinners, metric, 'B');
                return (
                  <div key={metric} className="col-span-4 md:col-span-1 rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{metricLabel(metric)}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className={resultA === 'win' ? 'text-emerald-600 font-semibold' : resultA === 'lose' ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}>
                        A: {compareData.players.A.metrics?.[metric] ?? 0}
                      </span>
                      <span className={resultB === 'win' ? 'text-emerald-600 font-semibold' : resultB === 'lose' ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}>
                        B: {compareData.players.B.metrics?.[metric] ?? 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default FeedScoutingReport;
