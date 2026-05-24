import { Link } from 'react-router-dom';

function statusLabel(status) {
  const map = {
    open: 'Open',
    ongoing: 'Ongoing',
    finished: 'Finished',
    pending: 'Pending approval',
    accepted: 'Participating',
    rejected: 'Rejected',
  };
  return map[status] || status || '';
}

const STAT_ICONS = {
  Tournaments: '🏆',
  Points: '⭐',
  'Team goals': '⚽',
  'Personal goals': '🎯',
  Assists: '🅰️',
};

export default function ProfileTournaments({ tournaments = [], totals = null }) {
  const rows = Array.isArray(tournaments) ? tournaments : [];

  if (!rows.length && !totals) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 px-6 py-12 text-center">
        <p className="text-4xl mb-3">🏟️</p>
        <p className="text-slate-500 dark:text-slate-400 font-medium">No tournament participation yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {totals ? (
        <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-emerald-950/80 to-slate-900 p-4 sm:p-5 shadow-xl shadow-emerald-900/20">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/90 mb-4">Career tournament stats</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Tournaments', value: totals.tournamentsPlayed ?? 0 },
              { label: 'Points', value: totals.points ?? 0 },
              { label: 'Team goals', value: totals.goalsFor ?? 0 },
              { label: 'Personal goals', value: totals.scorerGoals ?? 0 },
              { label: 'Assists', value: totals.scorerAssists ?? 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-4 text-center backdrop-blur-sm transition hover:bg-white/10"
              >
                <p className="text-lg mb-1">{STAT_ICONS[item.label]}</p>
                <div className="text-2xl sm:text-3xl font-black tabular-nums text-white">{item.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rows.map((row) => (
        <Link
          key={row.tournamentId}
          to={`/tournaments?tournamentId=${row.tournamentId}`}
          className="group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 dark:border-slate-700 dark:bg-slate-900/80"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {row.tournamentSeason && row.tournamentType === 'league'
                  ? `${row.tournamentName} ${row.tournamentSeason}`
                  : row.tournamentSeason
                    ? `${row.tournamentName} (${row.tournamentSeason})`
                    : row.tournamentName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {statusLabel(row.tournamentStatus)}
                {row.participantStatus && row.participantStatus !== 'accepted'
                  ? ` · ${statusLabel(row.participantStatus)}`
                  : ''}
                {row.tournamentType ? ` · ${row.tournamentType}` : ''}
              </p>
            </div>
            {row.rank ? (
              <span className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 px-3 py-1.5 text-sm font-black text-white shadow-lg shadow-emerald-500/30">
                #{row.rank}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { k: `${row.points ?? 0} pts`, c: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' },
              { k: `${row.played ?? 0} pl`, c: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
              { k: `${row.goalsFor ?? 0} GF`, c: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' },
              { k: `${row.scorerGoals ?? 0} G`, c: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
              { k: `${row.scorerAssists ?? 0} A`, c: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200' },
              { k: `GD ${row.goalDifference ?? 0}`, c: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
            ].map((chip) => (
              <span key={chip.k} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${chip.c}`}>
                {chip.k}
              </span>
            ))}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            View tournament <span aria-hidden>→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
