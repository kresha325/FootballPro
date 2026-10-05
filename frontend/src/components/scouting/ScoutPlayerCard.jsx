import { useState } from 'react';
import { Link } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import { getFullUrl } from '../../utils/mediaUrl';
import { apiError } from './scoutingState';

function Avatar({ player }) {
  const name = player.playerName || 'Lojtar';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return player.profilePhoto ? (
    <img src={getFullUrl(player.profilePhoto)} alt="" className="xt-avatar h-12 w-12 object-cover" />
  ) : (
    <span className="xt-avatar h-12 w-12">{initials}</span>
  );
}

function statText(block) {
  if (!block || block.insufficient && block.sampleSize === 0) return 'Pa të dhëna për këtë periudhë';
  const rating = block.rating == null ? null : Number(block.rating).toFixed(1);
  return [
    `${block.appearances ?? block.sampleSize ?? 0} ndeshje`,
    `${block.goals || 0} gola`,
    `${block.assists || 0} asiste`,
    block.minutes != null ? `${block.minutes} min` : null,
    rating ? `rating ${rating}` : null,
  ].filter(Boolean).join(' · ');
}

export default function ScoutPlayerCard({ player, onChange }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const global = player.ranking?.globalPerformance;
  const personal = player.ranking?.scoutEvaluation;
  const season = player.seasonStats || player.form?.last5;

  async function run(key, action) {
    setBusy(key);
    setError('');
    try {
      await action();
      onChange?.();
    } catch (err) {
      if (err?.response?.status !== 409) setError(apiError(err, 'Veprimi dështoi.'));
      else onChange?.();
    } finally {
      setBusy('');
    }
  }

  return (
    <article className="xt-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar player={player} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{player.playerName}</h3>
          <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">
            {[player.position, player.age != null ? `${player.age} vjeç` : null, player.nationality, player.club].filter(Boolean).join(' · ') || 'Profili publik është i paplotë'}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-[var(--xt-color-text-muted)]">Këmba</dt><dd>{player.preferredFoot || '—'}</dd></div>
        <div><dt className="text-[var(--xt-color-text-muted)]">Gjatësia</dt><dd>{player.height ? `${player.height} cm` : '—'}</dd></div>
        <div><dt className="text-[var(--xt-color-text-muted)]">Verifikimi</dt><dd>{player.verified ? 'I verifikuar' : 'I paverifikuar'}</dd></div>
        <div><dt className="text-[var(--xt-color-text-muted)]">Plotësimi</dt><dd>{player.completeness?.percent ?? 0}%</dd></div>
      </dl>
      <p className="mt-3 text-sm">
        <span className="font-semibold">Sezoni aktual: </span>
        {statText(season)}
      </p>
      <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">
        {player.insufficientMatchData || global?.score == null
          ? 'Nuk ka mjaft ndeshje zyrtare për një pikë performance.'
          : `Performanca zyrtare ${Number(global.score).toFixed(1)} / 100`}
        {personal?.score != null ? ` · Përputhja me preferencat ${Number(personal.score).toFixed(1)}` : ''}
      </p>
      {error ? <p className="mt-2 text-sm text-[var(--xt-color-danger)]" role="alert">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary" to={`/profile/${player.playerId}`}>Shiko profilin</Link>
        <button type="button" className="btn btn-outline" disabled={busy === 'short' || player.shortlisted} onClick={() => run('short', () => scoutingAPI.addShortlist({ playerId: player.playerId }))}>
          {player.shortlisted ? 'Në shortlist' : 'Shto në shortlist'}
        </button>
        <button type="button" className="btn btn-outline" disabled={busy === 'watch' || player.watchlisted} onClick={() => run('watch', () => scoutingAPI.addWatchlist({ playerId: player.playerId }))}>
          {player.watchlisted ? 'Në watchlist' : 'Shto në watchlist'}
        </button>
        <Link className="btn btn-quiet" to={`/scouting/compare?ids=${player.playerId}`}>Krahaso</Link>
        <Link className="btn btn-quiet" to={`/scouting/reports?playerId=${player.playerId}`}>Krijo raport</Link>
      </div>
    </article>
  );
}
