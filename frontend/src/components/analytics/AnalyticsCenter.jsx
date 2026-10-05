import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const RANGES = [
  { id: 'today', label: 'Sot' },
  { id: '7d', label: '7 ditë' },
  { id: '30d', label: '30 ditë' },
  { id: '90d', label: '90 ditë' },
  { id: 'season', label: 'Sezoni' },
  { id: 'career', label: 'Karriera' },
  { id: 'custom', label: 'Custom' },
];

const NAV = [
  { id: 'overview', label: 'Përmbledhje', to: '/analytics' },
  { id: 'player', label: 'Lojtari', to: '/analytics/player' },
  { id: 'club', label: 'Klubi', to: '/analytics/club' },
  { id: 'scouting', label: 'Scouting', to: '/analytics/scouting' },
  { id: 'marketplace', label: 'Marketplace', to: '/analytics/marketplace' },
  { id: 'video', label: 'Video', to: '/analytics/video' },
  { id: 'wallet', label: 'Wallet', to: '/analytics/wallet' },
];

function num(value) {
  if (value == null || value === '') return '—';
  return value;
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{num(value)}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Empty({ text }) {
  return <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">{text}</p>;
}

function PlayerPanel({ data }) {
  if (!data?.hasOfficial) {
    return <Empty text="Nuk ka ndeshje zyrtare për këtë lojtar. Statistikat shfaqen vetëm nga ndeshjet e regjistruara." />;
  }
  const window = data.window || {};
  const career = data.career || {};
  const trend = data.trends || {};
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Karriera (kumulative)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Ndeshje" value={career.appearances} />
          <Stat label="Startime" value={career.starts} />
          <Stat label="Minuta" value={career.minutes} />
          <Stat label="Gola" value={career.goals} />
          <Stat label="Asiste" value={career.assists} />
          <Stat label="Kartona" value={(career.yellowCards || 0) + (career.redCards || 0)} hint={`${career.yellowCards || 0} verdhë, ${career.redCards || 0} kuq`} />
          <Stat label="Fitore" value={career.wins} hint={`${career.draws || 0} barazime, ${career.losses || 0} humbje`} />
          <Stat label="Rating" value={career.rating} />
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Periudha e zgjedhur</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Ndeshje" value={window.appearances} hint={window.label} />
          <Stat label="Minuta" value={window.minutes} />
          <Stat label="Gola" value={window.goals} />
          <Stat label="Asiste" value={window.assists} />
          <Stat label="Rating" value={window.rating} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Stat label="5 ndeshjet e fundit" value={`${data.form?.last5?.goals || 0} gola`} hint={`${data.form?.last5?.assists || 0} asiste · rating ${num(data.form?.last5?.rating)}`} />
        <Stat label="10 ndeshjet e fundit" value={`${data.form?.last10?.goals || 0} gola`} hint={`${data.form?.last10?.assists || 0} asiste · rating ${num(data.form?.last10?.rating)}`} />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold">Trendi</h2>
        {!trend.sufficient ? (
          <Empty text={trend.emptyReason === 'no_matches' ? 'Nuk ka ndeshje në këtë filtër.' : 'Duhet të paktën dy ndeshje për një vijë trendi.'} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend.monthly?.length ? trend.monthly : trend.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={trend.monthly?.length ? 'month' : 'date'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="goals" name="Gola" stroke="#D9A441" />
              <Line type="monotone" dataKey="assists" name="Asiste" stroke="#42C98B" />
              <Line type="monotone" dataKey="minutes" name="Minuta" stroke="#70AAF5" />
              <Line type="monotone" dataKey="rating" name="Rating" stroke="#F36B72" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {Array.isArray(data.competitions) && data.competitions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="p-3">Gara</th>
                <th className="p-3">Ndeshje</th>
                <th className="p-3">Gola</th>
                <th className="p-3">Asiste</th>
                <th className="p-3">Minuta</th>
                <th className="p-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.competitions.map((row) => (
                <tr key={`${row.id}-${row.name}`} className="border-t border-gray-100">
                  <td className="p-3">{row.name} {row.season ? `· ${row.season}` : ''}</td>
                  <td className="p-3">{row.appearances}</td>
                  <td className="p-3">{row.goals}</td>
                  <td className="p-3">{row.assists}</td>
                  <td className="p-3">{row.minutes}</td>
                  <td className="p-3">{num(row.rating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function AnalyticsCenter() {
  const { user } = useAuth();
  const { section: sectionParam } = useParams();
  const navigate = useNavigate();
  const section = sectionParam || 'overview';
  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [season, setSeason] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [clubId, setClubId] = useState('');
  const [home, setHome] = useState(null);
  const [detail, setDetail] = useState(null);
  const [compare, setCompare] = useState(null);
  const [otherId, setOtherId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const query = { range };
    if (range === 'custom') {
      query.from = from;
      query.to = to;
    }
    if (season) query.season = season;
    if (competitionId) query.competitionId = competitionId;
    if (clubId) query.clubId = clubId;
    return query;
  }, [range, from, to, season, competitionId, clubId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (range === 'custom' && (!from || !to)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const homeRes = await api.get('/analytics/home', { params });
        if (cancelled) return;
        setHome(homeRes.data);
        if (section === 'overview') {
          setDetail(null);
        } else if (section === 'player') {
          const res = await api.get(`/analytics/player/${user.id}`, { params });
          if (!cancelled) setDetail(res.data);
        } else if (section === 'club') {
          const res = await api.get(`/analytics/club/${user.id}`, { params });
          if (!cancelled) setDetail(res.data);
        } else {
          const res = await api.get(`/analytics/${section}`, { params });
          if (!cancelled) setDetail(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.msg || 'Analitika nuk u ngarkua.');
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (user?.id) load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, section, params]);

  const visibleNav = NAV.filter((item) => item.id === 'overview' || home?.modules?.includes(item.id) || section === item.id);

  async function runCompare(event) {
    event.preventDefault();
    setCompare(null);
    setError('');
    try {
      const res = await api.get('/analytics/compare', { params: { ...params, kind: 'player', a: user.id, b: otherId } });
      setCompare(res.data);
    } catch (err) {
      setError(err?.response?.data?.msg || 'Krahasimi dështoi.');
    }
  }

  const playerFilters = detail?.filters || home?.player?.filters;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analitika</h1>
          <p className="text-sm text-gray-500">Të dhëna nga ndeshjet, postimet, porositë dhe ledger-i. Pa numra të simuluara.</p>
        </div>
        <Link to="/insights" className="text-sm font-semibold text-[var(--xt-color-gold-bright,#9A6B12)]">
          Insights sociale →
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {visibleNav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.to)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${section === item.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-2">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={`rounded-lg px-3 py-2 text-sm ${range === item.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}
          >
            {item.label}
          </button>
        ))}
        {range === 'custom' ? (
          <>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
          </>
        ) : null}
      </div>

      {section === 'player' && playerFilters ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <select value={season} onChange={(event) => setSeason(event.target.value)} className="rounded-lg border px-2 py-2 text-sm">
            <option value="">Çdo sezon</option>
            {(playerFilters.seasons || []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} className="rounded-lg border px-2 py-2 text-sm">
            <option value="">Çdo garë</option>
            {(playerFilters.competitions || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={clubId} onChange={(event) => setClubId(event.target.value)} className="rounded-lg border px-2 py-2 text-sm">
            <option value="">Çdo klub</option>
            {(playerFilters.clubs || []).map((item) => <option key={item} value={item}>Klubi {item}</option>)}
          </select>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Duke ngarkuar…</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loading && section === 'overview' && home ? (
        <div className="space-y-6">
          {home.socialLocked ? <Empty text="Analitika sociale kërkon planin Basic ose Pro. Statistikat e ndeshjeve dhe të wallet-it mbeten të hapura." /> : null}
          {home.player ? <PlayerPanel data={home.player} /> : null}
          {home.social?.period ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Shikime profili" value={home.social.period.profileViews} hint="Brenda periudhës. Jo çdo render." />
              <Stat label="Shikues unikë" value={home.social.period.uniqueViewers} />
              <Stat label="Ndjekës" value={home.social.cumulative?.followers} hint="Totali aktual, jo i filtruar." />
              <Stat label="Engagement" value={home.social.period.engagementRate == null ? '—' : `${home.social.period.engagementRate}%`} hint={home.social.period.engagementFormula} />
            </div>
          ) : null}
          {home.scoutingInterest ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Vlerësime scouting" value={home.scoutingInterest.evaluations} />
              <Stat label="Scout-a" value={home.scoutingInterest.scouts} />
              <Stat label="Rating mesatar" value={home.scoutingInterest.averageScoutRating} hint="Vetëm raporte të përfunduara. Shënimet private nuk shfaqen." />
            </div>
          ) : null}
          {home.scouting ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Lojtarë" value={home.scouting.playersDiscovered} />
              <Stat label="Shortlist" value={home.scouting.playersShortlisted} />
              <Stat label="Watchlist" value={home.scouting.playersWatched} />
              <Stat label="Raporte" value={home.scouting.reports?.completed} hint={`${home.scouting.reports?.draft || 0} draft`} />
            </div>
          ) : null}
          {home.club ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Skuadër" value={home.club.squadSize} hint={home.club.squadSizeLabel} />
              <Stat label="Ndeshje" value={home.club.matches} />
              <Stat label="Fitore" value={home.club.wins} hint={`${home.club.draws} barazime, ${home.club.losses} humbje`} />
              <Stat label="Gola" value={`${home.club.goalsScored}:${home.club.goalsConceded}`} hint="Shënuar : pësuar" />
            </div>
          ) : null}
          {home.marketplace ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Produkte aktive" value={home.marketplace.catalog?.activeProducts} hint={home.marketplace.catalog?.label} />
              <Stat label="Shitje" value={home.marketplace.orders?.sales} />
              <Stat label="Të ardhura bruto" value={home.marketplace.orders?.grossRevenue} hint={home.marketplace.orders?.currency} />
              <Stat label="Neto" value={home.marketplace.orders?.netRevenue} />
            </div>
          ) : null}
          {home.wallet ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Balanca" value={home.wallet.balance} hint={home.wallet.balanceLabel} />
              <Stat label="Blerë" value={home.wallet.activity?.purchased} />
              <Stat label="Shpenzuar" value={home.wallet.activity?.spent} />
              <Stat label="Transaksione" value={home.wallet.activity?.transactionCount} />
            </div>
          ) : null}
          {home.video?.videos ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Shikime video" value={home.video.videos.views} />
              <Stat label="Highlights" value={home.video.videos.highlightViews} />
              <Stat label="Media" value={home.video.videos.mediaViews} />
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && section === 'player' && detail ? (
        <div className="space-y-6">
          <PlayerPanel data={detail} />
          <form onSubmit={runCompare} className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-gray-600">
              Krahaso me lojtarin
              <input value={otherId} onChange={(event) => setOtherId(event.target.value)} placeholder="ID e lojtarit" className="mt-1 block rounded-lg border px-3 py-2" />
            </label>
            <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Krahaso</button>
          </form>
          {compare ? (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-3">Metrika</th>
                    <th className="p-3">{compare.left?.name || 'A'}</th>
                    <th className="p-3">{compare.right?.name || 'B'}</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.metrics.map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="p-3">{row.label} ({row.unit})</td>
                      <td className="p-3">{num(row.left)}</td>
                      <td className="p-3">{num(row.right)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && section === 'club' && detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Skuadër" value={detail.squadSize} hint={detail.squadSizeLabel} />
            <Stat label="Ndeshje" value={detail.completedMatches} hint={`${detail.upcomingMatches} të ardhshme`} />
            <Stat label="Fitore / barazime / humbje" value={`${detail.wins}/${detail.draws}/${detail.losses}`} />
            <Stat label="Gola" value={`${detail.goalsScored} - ${detail.goalsConceded}`} />
          </div>
          {detail.positions?.length ? (
            <div>
              <h2 className="mb-2 font-semibold">Pozicioni në tabelë</h2>
              {detail.positions.map((row) => (
                <p key={row.tournamentId} className="text-sm">{row.name} {row.season}: vendi {row.position} · {row.points} pikë</p>
              ))}
            </div>
          ) : <Empty text="Nuk ka tabelë aktive për këtë klub." />}
          {detail.players?.length ? (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="p-3">Lojtari</th><th className="p-3">Ndeshje</th><th className="p-3">Gola</th><th className="p-3">Asiste</th><th className="p-3">Minuta</th></tr></thead>
                <tbody>
                  {detail.players.map((row) => (
                    <tr key={row.userId} className="border-t">
                      <td className="p-3">{row.name || row.userId}</td>
                      <td className="p-3">{row.appearances}</td>
                      <td className="p-3">{row.goals}</td>
                      <td className="p-3">{row.assists}</td>
                      <td className="p-3">{row.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && section === 'scouting' && detail ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Lojtarë në hapësirën e punës" value={detail.playersDiscovered} hint={detail.playersDiscoveredNote} />
          <Stat label="Shortlist" value={detail.playersShortlisted} />
          <Stat label="Watchlist" value={detail.playersWatched} />
          <Stat label="Raporte të përfunduara" value={detail.reports?.completed} />
          <Stat label="Draft" value={detail.reports?.draft} />
          <Stat label="Prospekte aktive" value={detail.activeProspects} />
        </div>
      ) : null}

      {!loading && section === 'marketplace' && detail ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Produkte" value={detail.catalog?.products} hint={detail.catalog?.label} />
          <Stat label="Aktive" value={detail.catalog?.activeProducts} />
          <Stat label="Porosi" value={detail.orders?.orders} />
          <Stat label="Shitje" value={detail.orders?.sales} />
          <Stat label="Të dorëzuara" value={detail.orders?.completedOrders} />
          <Stat label="Të anuluara" value={detail.orders?.cancelledOrders} />
          <Stat label="Rimbursime" value={detail.orders?.refundedOrders} />
          <Stat label="Bruto" value={detail.orders?.grossRevenue} hint={detail.orders?.currency} />
          <Stat label="Tarifa" value={detail.orders?.platformFees} />
          <Stat label="Neto" value={detail.orders?.netRevenue} />
          <Stat label="Vlera mesatare" value={detail.orders?.averageOrderValue} />
        </div>
      ) : null}

      {!loading && section === 'video' && detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Shikime" value={detail.videos?.views} />
            <Stat label="Highlights" value={detail.videos?.highlightViews} />
            <Stat label="Media" value={detail.videos?.mediaViews} />
            <Stat label="Engagement" value={detail.videos?.engagement?.rate == null ? '—' : `${detail.videos.engagement.rate}%`} hint="Komente dhe shares nuk ruhen te videot." />
            <Stat label="Transmetime" value={detail.streams?.streamsStarted} />
            <Stat label="Shikues live tani" value={detail.streams?.liveViewersNow} />
            <Stat label="Kohëzgjatja" value={detail.streams?.durationSeconds} hint="Sekonda, nga fillimi dhe mbarimi." />
            <Stat label="Peak" value="—" hint={detail.streams?.peakConcurrentViewersReason} />
          </div>
          {(detail.videos?.top || []).map((video) => (
            <p key={video.id} className="text-sm">{video.title}: {video.views} shikime</p>
          ))}
        </div>
      ) : null}

      {!loading && section === 'wallet' && detail ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Balanca" value={detail.balance} hint={detail.balanceLabel} />
          <Stat label="Blerë" value={detail.activity?.purchased} />
          <Stat label="Shpenzuar" value={detail.activity?.spent} />
          <Stat label="Marrë" value={detail.activity?.received} />
          <Stat label="Rimbursime" value={detail.activity?.refunds} />
          <Stat label="Transaksione" value={detail.activity?.transactionCount} />
        </div>
      ) : null}
    </div>
  );
}
