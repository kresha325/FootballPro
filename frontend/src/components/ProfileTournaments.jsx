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

export default function ProfileTournaments({ tournaments = [], totals = null }) {
  const rows = Array.isArray(tournaments) ? tournaments : [];

  if (!rows.length && !totals) {
    return <p className="text-gray-500 dark:text-gray-400">No tournament participation yet.</p>;
  }

  return (
    <div className="space-y-4">
      {totals ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Tournaments', value: totals.tournamentsPlayed ?? 0 },
            { label: 'Points', value: totals.points ?? 0 },
            { label: 'Team goals', value: totals.goalsFor ?? 0 },
            { label: 'Personal goals', value: totals.scorerGoals ?? 0 },
            { label: 'Assists', value: totals.scorerAssists ?? 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{item.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {rows.map((row) => (
        <Link
          key={row.tournamentId}
          to={`/tournaments?tournamentId=${row.tournamentId}`}
          className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {row.tournamentSeason && row.tournamentType === 'league'
                  ? `${row.tournamentName} ${row.tournamentSeason}`
                  : row.tournamentSeason
                    ? `${row.tournamentName} (${row.tournamentSeason})`
                    : row.tournamentName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {statusLabel(row.tournamentStatus)}
                {row.participantStatus && row.participantStatus !== 'accepted'
                  ? ` · ${statusLabel(row.participantStatus)}`
                  : ''}
                {row.tournamentType ? ` · ${row.tournamentType}` : ''}
              </p>
            </div>
            {row.rank ? <span className="text-emerald-700 dark:text-emerald-400 font-bold">#{row.rank}</span> : null}
          </div>
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
            {row.points ?? 0} pts · {row.played ?? 0} played · {row.goalsFor ?? 0} team GF · {row.scorerGoals ?? 0} personal G · {row.scorerAssists ?? 0} ast · GD {row.goalDifference ?? 0}
          </p>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-2 inline-block">View tournament →</span>
        </Link>
      ))}
    </div>
  );
}
