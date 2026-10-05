import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import ScoutPlayerCard from './ScoutPlayerCard';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

export default function ScoutingDashboard() {
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, preferences] = await Promise.all([
        scoutingAPI.getDashboard({ signal }),
        scoutingAPI.getPreferences(),
      ]);
      if (signal.aborted) return;
      setData(dashboard.data);
      setPrefs(preferences.data);
    } catch (err) {
      if (!signal.aborted) setError(apiError(err, 'Paneli nuk u ngarkua.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadKey]);

  async function savePrefs(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const positions = String(form.get('positions') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const countries = String(form.get('countries') || '').split(',').map((item) => item.trim()).filter(Boolean);
    try {
      const response = await scoutingAPI.savePreferences({
        positions,
        countries,
        minAge: form.get('minAge') || null,
        maxAge: form.get('maxAge') || null,
        foot: form.get('foot') || null,
        competitionLevel: form.get('competitionLevel') || null,
      });
      setPrefs(response.data);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Preferencat nuk u ruajtën.'));
    }
  }

  if (loading) return <LoadingBlock label="Po ngarkohet paneli" />;
  if (error && !data) return <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  if (!data) return <EmptyBlock title="Paneli është bosh" text="Nuk ka ende aktivitet scouting." />;

  const sections = [
    ['Rekomandime', data.discovery?.recommended || [], 'Lojtarë të renditur sipas performancës zyrtare dhe preferencave të tua.'],
    ['Lojtarë të rinj', data.discovery?.newPlayers || [], 'Profile të krijuara në 30 ditët e fundit. Pa ndeshje, nuk shfaqet pikë performance.'],
    ['Në formë së fundmi', data.discovery?.trending || [], 'Gola dhe asiste nga ndeshjet e 45 ditëve të fundit.'],
  ];

  return (
    <div className="space-y-6">
      {error ? <ErrorBlock message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Shortlist aktive', data.shortlist?.active ?? 0],
          ['Prioritet i lartë', data.shortlist?.highPriority ?? 0],
          ['Raporte draft', data.reports?.drafts ?? 0],
          ['Raporte të përfunduara', data.reports?.completed ?? 0],
        ].map(([label, value]) => (
          <div className="xt-stat-card" key={label}>
            <div className="text-2xl font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{value}</div>
            <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{label}</p>
          </div>
        ))}
      </section>

      <form className="xt-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={savePrefs}>
        <div className="sm:col-span-2 lg:col-span-3">
          <h2 className="text-xl font-semibold">Preferencat e skautit</h2>
          <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">Përdoren vetëm për përputhjen personale. Nuk ndryshojnë pikën e performancës zyrtare.</p>
        </div>
        <label><span className="label">Pozicionet</span><input className="input" name="positions" defaultValue={(prefs?.positions || []).join(', ')} placeholder="forward, winger" /></label>
        <label><span className="label">Shtetet</span><input className="input" name="countries" defaultValue={(prefs?.countries || []).join(', ')} placeholder="Albania" /></label>
        <label><span className="label">Niveli i kompeticionit</span><input className="input" name="competitionLevel" defaultValue={prefs?.competitionLevel || ''} /></label>
        <label><span className="label">Mosha nga</span><input className="input" name="minAge" type="number" min="8" max="60" defaultValue={prefs?.minAge ?? ''} /></label>
        <label><span className="label">Mosha deri</span><input className="input" name="maxAge" type="number" min="8" max="60" defaultValue={prefs?.maxAge ?? ''} /></label>
        <label><span className="label">Këmba</span>
          <select className="select" name="foot" defaultValue={prefs?.foot || ''}>
            <option value="">Çdo këmbë</option>
            <option value="left">Majtas</option>
            <option value="right">Djathtas</option>
            <option value="both">Të dyja</option>
          </select>
        </label>
        <div><button className="btn btn-primary" type="submit">Ruaj preferencat</button></div>
      </form>

      {sections.map(([title, players, note]) => (
        <section key={title} className="space-y-3">
          <div className="xt-section-header"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{note}</p></div></div>
          {players.length === 0 ? <EmptyBlock title="Asnjë lojtar" text="Nuk ka të dhëna për këtë seksion." /> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {players.map((player) => <ScoutPlayerCard key={`${title}-${player.playerId}`} player={player} onChange={() => setReloadKey((value) => value + 1)} />)}
            </div>
          )}
        </section>
      ))}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="xt-card p-4">
          <h2 className="text-xl font-semibold">Ndjekjet</h2>
          {(data.shortlist?.followUps || []).length === 0 ? <p className="mt-3 text-sm text-[var(--xt-color-text-muted)]">Nuk ka data ndjekjeje të hapura.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.shortlist.followUps.map((item) => (
                <li key={item.id}><Link to={`/profile/${item.playerId}`} className="font-semibold">{item.playerName}</Link> · {item.priority} · {item.followUpDate}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="xt-card p-4">
          <h2 className="text-xl font-semibold">Ndryshimet në watchlist</h2>
          {(data.watchlist?.recentChanges || []).length === 0 ? <p className="mt-3 text-sm text-[var(--xt-color-text-muted)]">Nuk ka ndryshime të reja.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.watchlist.recentChanges.map((item) => <li key={item.id}>{item.summary}</li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="xt-card p-4">
        <h2 className="text-xl font-semibold">Aktiviteti</h2>
        {(data.activity || []).length === 0 ? <p className="mt-3 text-sm text-[var(--xt-color-text-muted)]">Ende pa raporte ose shortlist.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.activity.map((item, index) => <li key={`${item.type}-${index}`}>{item.label}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
