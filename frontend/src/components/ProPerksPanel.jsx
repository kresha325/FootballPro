import { useState } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { hasTier } from '../utils/subscriptionAccess';
import {
  PROFILE_THEMES,
  EARLY_ACCESS_FEATURES,
  loadEarlyAccessPrefs,
  saveEarlyAccessPrefs,
  prioritySupportMailto,
} from '../utils/profileThemes';

export default function ProPerksPanel({ user, profileTheme = 'default', onThemeSaved }) {
  const isPro = hasTier(user, 'pro');
  const [theme, setTheme] = useState(profileTheme || 'default');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMsg, setThemeMsg] = useState('');
  const [labs, setLabs] = useState(() => loadEarlyAccessPrefs());

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const saveTheme = async (nextId) => {
    if (!isPro && nextId !== 'default') {
      setThemeMsg('Temat e personalizuara kërkojnë Pro.');
      return;
    }
    setSavingTheme(true);
    setThemeMsg('');
    try {
      const form = new FormData();
      form.append('profileTheme', nextId);
      await profileAPI.updateProfile(form);
      setTheme(nextId);
      onThemeSaved?.(nextId);
      setThemeMsg('Tema u ruajt.');
    } catch (err) {
      setThemeMsg(err?.response?.data?.msg || 'Nuk u ruajt tema.');
    } finally {
      setSavingTheme(false);
    }
  };

  const toggleLab = (id) => {
    if (!isPro) return;
    const next = { ...labs, [id]: !labs[id] };
    setLabs(next);
    saveEarlyAccessPrefs(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">Përfitime Pro</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isPro
            ? 'Tema profili, akses i hershëm dhe suport prioritar.'
            : 'Këto tipare aktivizohen me planin Pro.'}{' '}
          {!isPro ? (
            <Link to="/premium" className="font-semibold text-[var(--xt-color-gold-bright)]">
              Upgrade →
            </Link>
          ) : null}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <h3 className="font-semibold text-gray-900 dark:text-white">Tema e profilit</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Ngjyra e theksit në profilin tënd publik.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROFILE_THEMES.map((t) => {
            const selected = theme === t.id;
            const locked = !isPro && t.id !== 'default';
            return (
              <button
                key={t.id}
                type="button"
                disabled={savingTheme || locked}
                onClick={() => saveTheme(t.id)}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  selected
                    ? 'border-[var(--xt-color-gold)] bg-white shadow-sm dark:bg-gray-900'
                    : 'border-gray-200 bg-white/70 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-900/40'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={locked ? 'Kërkon Pro' : t.label}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ background: t.accent }}
                  aria-hidden
                />
                {t.label}
              </button>
            );
          })}
        </div>
        {themeMsg ? <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{themeMsg}</p> : null}
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <h3 className="font-semibold text-gray-900 dark:text-white">Akses i hershëm (Labs)</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Tipare eksperimentale për anëtarët Pro.
        </p>
        <ul className="mt-3 space-y-2">
          {EARLY_ACCESS_FEATURES.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900/50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
              </div>
              <button
                type="button"
                disabled={!isPro}
                onClick={() => toggleLab(f.id)}
                className={`min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold ${
                  labs[f.id]
                    ? 'bg-[var(--xt-color-gold)] text-slate-950'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                } disabled:opacity-50`}
              >
                {labs[f.id] ? 'On' : 'Off'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--xt-color-gold)]/40 bg-[var(--xt-color-gold)]/10 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Suport prioritar</h3>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
          Anëtarët Pro dërgojnë kërkesa me etikettën Priority — ekipi i jep përparësi.
        </p>
        {isPro ? (
          <a
            href={prioritySupportMailto({
              userId: user?.id,
              name: displayName,
              email: user?.email,
            })}
            className="btn btn-primary mt-3 inline-flex min-h-11"
          >
            Shkruaj support prioritar
          </a>
        ) : (
          <Link to="/premium" className="btn btn-outline mt-3 inline-flex min-h-11">
            Aktivizo Pro për suport prioritar
          </Link>
        )}
      </section>
    </div>
  );
}
