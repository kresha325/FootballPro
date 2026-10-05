import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import FeedScoutingReport from '../FeedScoutingReport';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

const METRICS = [
  ['age', 'Mosha'],
  ['position', 'Pozicioni'],
  ['height', 'Gjatësia'],
  ['preferredFoot', 'Këmba'],
  ['appearances', 'Ndeshje'],
  ['minutes', 'Minuta'],
  ['goals', 'Gola'],
  ['assists', 'Asiste'],
  ['yellowCards', 'Të verdha'],
  ['redCards', 'Të kuqe'],
  ['rating', 'Rating'],
];

export default function ScoutingCompare() {
  const [params, setParams] = useSearchParams();
  const [ids, setIds] = useState(params.get('ids') || '');
  const [windowName, setWindowName] = useState(params.get('window') || 'season');
  const [season, setSeason] = useState(params.get('season') || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextIds = ids) {
    const list = nextIds.split(',').map((item) => item.trim()).filter(Boolean);
    if (list.length < 2) {
      setResult(null);
      setError('Zgjidh të paktën dy lojtarë.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await scoutingAPI.comparePlayers({
        ids: list.slice(0, 4).join(','),
        window: windowName,
        season: season || undefined,
      });
      setResult(response.data);
      setParams({ ids: list.slice(0, 4).join(','), window: windowName, ...(season ? { season } : {}) });
    } catch (err) {
      setResult(null);
      setError(apiError(err, 'Krahasimi dështoi.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialIds = params.get('ids') || '';
    if (initialIds.split(',').filter(Boolean).length < 2) return undefined;
    queueMicrotask(() => load(initialIds));
    return undefined;
    // Load once from the URL. Later searches go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const players = result?.players || [];

  return (
    <div className="space-y-4">
      <form className="xt-card grid gap-3 p-4 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="sm:col-span-2"><span className="label">ID e lojtarëve (2–4)</span><input className="input" value={ids} onChange={(event) => setIds(event.target.value)} placeholder="12, 18, 24" /></label>
        <label><span className="label">Periudha</span>
          <select className="select" value={windowName} onChange={(event) => setWindowName(event.target.value)}>
            <option value="season">Sezoni</option>
            <option value="career">Karriera</option>
            <option value="last5">5 ndeshjet e fundit</option>
            <option value="last10">10 ndeshjet e fundit</option>
          </select>
        </label>
        <label><span className="label">Sezoni</span><input className="input" value={season} onChange={(event) => setSeason(event.target.value)} placeholder="2026/2027" /></label>
        <div className="sm:col-span-4"><button className="btn btn-primary" type="submit">Krahaso</button></div>
      </form>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={() => load()} /> : players.length === 0 ? (
        <EmptyBlock title="Asnjë krahasim" text="Të gjithë lojtarët krahasohen në të njëjtën periudhë. Karriera dhe sezoni nuk përzihen." />
      ) : (
        <div className="xt-card xt-table-wrap overflow-x-auto">
          <p className="p-4 text-sm font-semibold">{result.period?.label}</p>
          <table className="xt-table min-w-[720px]">
            <thead>
              <tr>
                <th>Treguesi</th>
                {players.map((player) => <th key={player.playerId}><Link to={`/profile/${player.playerId}`}>{player.playerName}</Link></th>)}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {players.map((player) => {
                    const identity = ['age', 'position', 'height', 'preferredFoot'].includes(key);
                    const value = identity ? player[key] : player.stats?.[key];
                    const noMatches = !identity && Number(player.stats?.sampleSize || 0) === 0;
                    return <td key={player.playerId}>{noMatches ? 'Pa ndeshje' : (value ?? '—')}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FeedScoutingReport />
    </div>
  );
}
