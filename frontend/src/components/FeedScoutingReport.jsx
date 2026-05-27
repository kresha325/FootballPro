import { useEffect, useMemo, useState } from 'react';
import { scoutingAPI } from '../services/api';
import { AGE_GROUP_OPTIONS, metricLabel, scoreTone, winnerForMetric } from '../utils/scoutingScore';

function avatarOrFallback(url) {
  if (!url) return '/default-avatar.svg';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
}

const METRICS = ['goals', 'assists', 'likes', 'followers'];

const FeedScoutingReport = () => {
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
  }, [ageGroup]);

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
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 p-4 md:p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Scouting Report</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Compare two followed athletes by goals, assists, likes and followers.
          </p>
        </div>
        <select
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          className="min-h-11 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
        >
          {AGE_GROUP_OPTIONS.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </div>

      {loadingCandidates ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-pulse">
          <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : candidates.length < 2 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 text-sm text-slate-600 dark:text-slate-300">
          You need at least 2 followed athletes in this age group to generate a scouting comparison.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[{ label: 'Player A', value: playerAId, onChange: setPlayerAId }, { label: 'Player B', value: playerBId, onChange: setPlayerBId }].map((slot) => (
              <div key={slot.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{slot.label}</label>
                <select
                  value={slot.value}
                  onChange={(e) => slot.onChange(e.target.value)}
                  className="mt-2 w-full min-h-11 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} {c.position ? `· ${c.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col justify-between sticky bottom-20 lg:static bg-white dark:bg-gray-900">
              <p className="text-sm text-slate-600 dark:text-slate-300">Generate 0-100 rule-based score and metric winners.</p>
              <button
                type="button"
                onClick={runCompare}
                disabled={!canCompare || comparing}
                className="mt-2 min-h-11 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700"
              >
                {comparing ? 'Comparing...' : 'Compare Players'}
              </button>
            </div>
          </div>

          {(playerA || playerB) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{ label: 'A', player: playerA }, { label: 'B', player: playerB }].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
                  <img
                    src={avatarOrFallback(item.player?.profilePhoto)}
                    alt={item.player?.fullName || `Player ${item.label}`}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-600"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{item.player?.fullName || '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.player?.position || 'No position'} {item.player?.club ? `· ${item.player.club}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {compareData?.players?.A && compareData?.players?.B ? (
        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 md:p-4">
          <div className="grid grid-cols-3 items-center gap-2 mb-3">
            <div className="text-center">
              <p className="text-xs text-slate-500">Player A</p>
              <p className={`text-2xl font-bold ${scoreTone(compareData.players.A.score)}`}>{compareData.players.A.score}</p>
            </div>
            <div className="text-center text-xs uppercase tracking-wide text-slate-500">
              {compareData.comparison?.winner === 'draw' ? 'Draw' : `${compareData.comparison?.winner} wins`}
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Player B</p>
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

