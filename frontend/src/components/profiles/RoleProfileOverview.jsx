import React, { useEffect, useState } from 'react';
import { clubStaffAPI } from '../../services/api';

const ROLE_PRESENTATION = {
  coach: {
    label: 'Trajner', icon: '⚽', color: 'sky',
    headline: 'Profili i trajnerit', subline: 'Përvojë, metodologji dhe angazhime në futboll.',
    fields: [['Specializimi', 'coachCategory'], ['Lidhja profesionale', 'coachAffiliation'], ['Klubi', 'club']],
    stats: [['Vite përvojë', 'yearsExperience'], ['Skuadra', 'teamsCoached'], ['Trofe', 'trophies']],
  },
  trajner: {
    label: 'Trajner', icon: '⚽', color: 'sky',
    headline: 'Profili i trajnerit', subline: 'Përvojë, metodologji dhe angazhime në futboll.',
    fields: [['Specializimi', 'coachCategory'], ['Lidhja profesionale', 'coachAffiliation'], ['Klubi', 'club']],
    stats: [['Vite përvojë', 'yearsExperience'], ['Skuadra', 'teamsCoached'], ['Trofe', 'trophies']],
  },
  scout: {
    label: 'Skaut', icon: '⌕', color: 'violet',
    headline: 'Profili i skautimit', subline: 'Fokus, rajone dhe përvojë në zbulimin e talenteve.',
    fields: [['Klubi / organizata', 'club']],
    stats: [['Vite përvojë', 'yearsExperience'], ['Lojtarë të zbuluar', 'playersDiscovered'], ['Transferime', 'successfulSigns']],
    lists: [['Specializimet', 'specializations'], ['Rajonet', 'regions']],
  },
  manager: {
    label: 'Menaxher', icon: '▤', color: 'amber',
    headline: 'Profili i menaxherit', subline: 'Përfaqësim, specializime dhe karrierë profesionale.',
    stats: [['Vite përvojë', 'yearsExperience'], ['Lojtarë të menaxhuar', 'playersManaged'], ['Marrëveshje', 'dealsNegotiated']],
    lists: [['Klientët', 'currentClients'], ['Specializimet', 'specializations'], ['Licencat', 'licenses'], ['Marrëveshjet', 'notableDeals']],
  },
  referee: {
    label: 'Arbitër', icon: '⚖', color: 'emerald',
    headline: 'Profili i arbitrit', subline: 'Niveli, certifikimet dhe përvoja në ndeshje.',
    stats: [['Vite përvojë', 'yearsExperience'], ['Ndeshje', 'matchesOfficiated'], ['Certifikime', 'certifications'], ['Niveli', 'currentLevel']],
    lists: [['Certifikime', 'licenses'], ['Kompeticionet', 'competitions']],
  },
  federation: {
    label: 'Federatë', icon: '◈', color: 'blue',
    headline: 'Profili i federatës', subline: 'Informacion zyrtar dhe prezantim institucional.',
    fields: [['Viti i themelimit', 'foundedYear'], ['Website', 'contact.website'], ['Qyteti', 'city'], ['Shteti', 'country']],
  },
  business: {
    label: 'Biznes sportiv', icon: '▣', color: 'orange',
    headline: 'Profili i biznesit', subline: 'Shërbime dhe bashkëpunime në ekosistemin sportiv.',
    fields: [['Industria', 'industry'], ['Madhësia', 'companySize'], ['Website', 'contact.website'], ['Qyteti', 'city'], ['Shteti', 'country']],
    lists: [['Shërbime', 'services'], ['Partneritete', 'sponsorships'], ['Çmime', 'awards']],
  },
  media: {
    label: 'Media sportive', icon: '▸', color: 'rose',
    headline: 'Profili i medias', subline: 'Publikime, mbulim sportiv dhe kanale zyrtare.',
    fields: [['Fusha e mbulimit', 'industry'], ['Website', 'contact.website'], ['Qyteti', 'city'], ['Shteti', 'country']],
    lists: [['Shërbime mediatike', 'services'], ['Platformat', 'platforms']],
  },
};

const TONE = {
  sky: 'from-sky-500/15 via-cyan-500/5 to-transparent border-sky-500/25 text-sky-700 dark:text-sky-300',
  violet: 'from-violet-500/15 via-fuchsia-500/5 to-transparent border-violet-500/25 text-violet-700 dark:text-violet-300',
  amber: 'from-amber-500/15 via-yellow-500/5 to-transparent border-amber-500/25 text-amber-700 dark:text-amber-300',
  emerald: 'from-emerald-500/15 via-teal-500/5 to-transparent border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
  blue: 'from-blue-500/15 via-indigo-500/5 to-transparent border-blue-500/25 text-blue-700 dark:text-blue-300',
  orange: 'from-orange-500/15 via-amber-500/5 to-transparent border-orange-500/25 text-orange-700 dark:text-orange-300',
  rose: 'from-rose-500/15 via-pink-500/5 to-transparent border-rose-500/25 text-rose-700 dark:text-rose-300',
};

function present(value) {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
}

function formatValue(value) {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? item?.name || item?.title || item?.label || item?.player || item?.organization : item)).filter(Boolean).join(' · ');
  if (typeof value === 'object') return value.name || value.title || value.label || value.player || value.organization || '';
  return String(value).replace(/_/g, ' ');
}

export default function RoleProfileOverview({ profile = {}, role: roleProp }) {
  const role = String(roleProp || profile.role || '').toLowerCase();
  const presentation = ROLE_PRESENTATION[role];

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [staffAssignmentsLoaded, setStaffAssignmentsLoaded] = useState(false);
  const userId = profile.userId || profile.id;
  useEffect(() => {
    let cancelled = false;
    if (!['coach', 'trajner'].includes(role) || !userId) {
      setStaffAssignments([]);
      setStaffAssignmentsLoaded(true);
      return undefined;
    }
    setStaffAssignmentsLoaded(false);
    clubStaffAPI.getStaffAssignments(userId)
      .then((res) => { if (!cancelled) setStaffAssignments(Array.isArray(res.data) ? res.data.filter((item) => item.status === 'active') : []); })
      .catch(() => { if (!cancelled) setStaffAssignments([]); })
      .finally(() => { if (!cancelled) setStaffAssignmentsLoaded(true); });
    return () => { cancelled = true; };
  }, [role, userId]);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.club || profile.name || presentation.label;
  const fields = presentation.fields || [];
  const valueAt = (source, key) => key.split('.').reduce((value, part) => value?.[part], source);
  const visibleFields = fields.map(([label, key]) => [label, valueAt(profile, key) ?? valueAt(stats, key)]).filter(([, value]) => present(value));
  const statsCards = (presentation.stats || []).map(([label, key]) => [label, stats[key] ?? profile[key]]).filter(([, value]) => present(value));
  const lists = (presentation.lists || []).map(([label, key]) => [label, stats[key] ?? profile[key]]).filter(([, value]) => present(value));
  const career = Array.isArray(profile.careerHistory) ? profile.careerHistory : typeof profile.careerHistory === 'string' ? profile.careerHistory.split(/\n+/).filter(Boolean) : [];
  if (!presentation) return null;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <section className={`overflow-hidden rounded-2xl border bg-gradient-to-br ${TONE[presentation.color]}`}>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-current/20 bg-white/70 text-2xl shadow-sm dark:bg-slate-950/40" aria-hidden="true">{presentation.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[.18em] opacity-80">{presentation.label}</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--xt-color-text)]">{name}</h2>
            <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{presentation.subline}</p>
          </div>
          {visibleFields.slice(0, 2).length ? (
            <div className="flex flex-wrap gap-2 sm:max-w-[42%] sm:justify-end">
              {visibleFields.slice(0, 2).map(([label, value]) => (
                <span key={label} className="rounded-full border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)]/80 px-3 py-1.5 text-xs font-semibold text-[var(--xt-color-text)]">{formatValue(value)}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {profile.bio ? (
        <section className="xt-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-text-subtle)]">{role === 'coach' || role === 'trajner' ? 'Metodologjia' : 'Rreth profilit'}</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[var(--xt-color-text)]">{profile.bio}</p>
        </section>
      ) : null}

      {statsCards.length ? (
        <section className="xt-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--xt-color-text-muted)]">Tregues profesionalë</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statsCards.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] p-4">
                <div className="text-xl font-bold text-[var(--xt-color-text)]">{formatValue(value)}</div>
                <div className="mt-1 text-xs font-medium text-[var(--xt-color-text-muted)]">{label}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {['coach', 'trajner'].includes(role) ? (
        <section className="xt-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--xt-color-text-muted)]">Angazhimet me klube</h3>
          {staffAssignments.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {staffAssignments.map((assignment) => {
                const club = assignment.club || assignment.Club || {};
                const clubName = club.Profile?.club || [club.firstName, club.lastName].filter(Boolean).join(' ') || 'Klub';
                return <div key={assignment.id} className="rounded-lg border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] px-4 py-3"><div className="font-semibold text-[var(--xt-color-text)]">{clubName}</div><div className="mt-1 text-xs text-[var(--xt-color-text-muted)]">{[assignment.staffRole || assignment.role, assignment.teamType, assignment.status].filter(Boolean).map((item) => String(item).replace(/_/g, ' ')).join(' · ')}</div></div>;
              })}
            </div>
          ) : <p className="text-sm text-[var(--xt-color-text-muted)]">{staffAssignmentsLoaded ? 'Nuk ka angazhime aktive të regjistruara.' : 'Po ngarkohen angazhimet…'}</p>}
        </section>
      ) : null}

      {visibleFields.length > 2 ? (
        <section className="xt-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--xt-color-text-muted)]">Informacion profesional</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {visibleFields.slice(2).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[var(--xt-color-surface-raised)] px-4 py-3">
                <dt className="text-xs font-medium text-[var(--xt-color-text-subtle)]">{label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold capitalize text-[var(--xt-color-text)]">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {lists.map(([label, values]) => {
        const items = Array.isArray(values) ? values : [values];
        return (
          <section key={label} className="xt-card p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--xt-color-text-muted)]">{label}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => <span key={`${label}-${index}`} className="rounded-full border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] px-3 py-1.5 text-sm text-[var(--xt-color-text)]">{formatValue(item)}</span>)}
            </div>
          </section>
        );
      })}

      {career.length ? (
        <section className="xt-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--xt-color-text-muted)]">Përvoja profesionale</h3>
          <div className="space-y-2">
            {career.map((item, index) => <div key={index} className="rounded-lg border-l-2 border-[var(--xt-color-gold)] bg-[var(--xt-color-surface-raised)] px-4 py-3 text-sm text-[var(--xt-color-text)]">{formatValue(item)}</div>)}
          </div>
        </section>
      ) : null}

      {!profile.bio && !statsCards.length && !visibleFields.length && !lists.length && !career.length ? (
        <section className="xt-card p-6 text-sm text-[var(--xt-color-text-muted)]">Profili profesional po plotësohet. Shto specializimin, përvojën ose informacionin përkatës që të shfaqet këtu.</section>
      ) : null}
    </div>
  );
}
