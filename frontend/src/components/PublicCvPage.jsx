import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FacebookIcon,
  FacebookShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from 'react-share';
import { profileAPI } from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';
import { getFoundingYear, isOrgProfileRole } from '../utils/orgProfile';
import { APP_BRAND_NAME, APP_LOGO_SRC } from '../config/branding';
import { getProfileCvShareText, getProfileCvShareUrl } from '../utils/shareProfile';

const ROLE_LABELS = {
  athlete: 'Futbollist',
  coach: 'Trajner',
  trajner: 'Trajner',
  scout: 'Skaut',
  manager: 'Menaxher',
  referee: 'Arbitër',
  club: 'Klub',
  liga: 'Ligë',
  federation: 'Federatë',
  business: 'Business',
  media: 'Media',
};

function roleLabel(role) {
  const key = String(role || '').toLowerCase();
  return ROLE_LABELS[key] || role || 'Profil';
}

function StatCard({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{String(value)}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function PublicCvPage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await profileAPI.getPublicCv(id);
        if (!cancelled) setProfile(res.data);
      } catch {
        if (!cancelled) {
          setProfile(null);
          setError('Profili nuk u gjet ose nuk është i disponueshëm publikisht.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const displayName = useMemo(() => {
    if (!profile) return '';
    const full = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    if (full) return full;
    return profile.club || roleLabel(profile.role);
  }, [profile]);

  const shareUrl = profile ? getProfileCvShareUrl(profile.id || id) : '';
  const shareText = profile ? getProfileCvShareText(profile) : '';

  useEffect(() => {
    if (!profile) return undefined;
    const prev = document.title;
    document.title = `${displayName} · CV · ${APP_BRAND_NAME}`;
    return () => {
      document.title = prev;
    };
  }, [profile, displayName]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Kopjo linkun e CV:', shareUrl);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg text-slate-600">{error || 'Profili nuk u gjet'}</p>
        <Link to="/" className="mt-6 inline-block text-emerald-700 hover:underline">
          Kthehu te {APP_BRAND_NAME}
        </Link>
      </div>
    );
  }

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const isOrg = isOrgProfileRole(profile.role);
  const founding = profile.foundingYear || getFoundingYear(profile);

  const highlightStats = [
    { label: 'Gjatësia', value: stats.height ? `${stats.height} cm` : null },
    { label: 'Pesha', value: stats.weight ? `${stats.weight} kg` : null },
    { label: 'Numri', value: stats.jerseyNumber ? `#${stats.jerseyNumber}` : null },
    { label: 'Këmba', value: stats.preferredFoot || null },
    { label: 'Stadiumi', value: profile.stadium || stats.stadium || null },
    { label: 'Kapaciteti', value: profile.capacity || stats.capacity || null },
    { label: 'Liga', value: profile.league || stats.league || null },
    { label: 'Industria', value: stats.industry || null },
  ].filter((s) => s.value != null && s.value !== '');

  const extraStatEntries = Object.entries(stats).filter(([key, val]) => {
    if (val == null || val === '') return false;
    const skip = new Set([
      'height',
      'weight',
      'jerseyNumber',
      'preferredFoot',
      'stadium',
      'capacity',
      'league',
      'founded',
      'foundedYear',
      'industry',
    ]);
    return !skip.has(key) && (typeof val === 'string' || typeof val === 'number');
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-emerald-50">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-slate-900">
            <img src={APP_LOGO_SRC} alt="" className="h-8 w-8 object-contain" />
            <span>{APP_BRAND_NAME}</span>
          </Link>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            CV dixhitale
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-36 bg-gradient-to-r from-emerald-700 to-slate-800 sm:h-44">
            {profile.coverPhoto && (
              <img
                src={getFullUrl(profile.coverPhoto)}
                alt=""
                className="h-full w-full object-cover opacity-90"
              />
            )}
          </div>

          <div className="relative px-5 pb-6 pt-0 sm:px-8">
            <div className="-mt-12 flex flex-col items-center gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              <img
                src={profile.profilePhoto ? getFullUrl(profile.profilePhoto) : '/default-avatar.svg'}
                alt={displayName}
                className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md sm:h-28 sm:w-28"
              />
              <div className="flex-1 text-center sm:pb-1 sm:text-left">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                    {roleLabel(profile.role)}
                  </span>
                  {profile.position && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                      {profile.position}
                    </span>
                  )}
                  {isOrg && founding && (
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-800">
                      Themeluar {founding}
                    </span>
                  )}
                  {!isOrg && profile.age != null && (
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-800">
                      {profile.age} vjeç{profile.ageGroup ? ` · ${profile.ageGroup}` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {[profile.club, profile.city, profile.country].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {profile.bio && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{profile.bio}</p>
              </section>
            )}

            {(highlightStats.length > 0 || extraStatEntries.length > 0) && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Stats</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {highlightStats.map((s) => (
                    <StatCard key={s.label} label={s.label} value={s.value} />
                  ))}
                  {extraStatEntries.map(([key, val]) => (
                    <StatCard key={key} label={key} value={val} />
                  ))}
                </div>
              </section>
            )}

            {profile.careerHistory && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Karriera</h2>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{profile.careerHistory}</p>
              </section>
            )}

            {Array.isArray(profile.achievements) && profile.achievements.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Arritje</h2>
                <ul className="space-y-2">
                  {profile.achievements.map((a, i) => (
                    <li
                      key={a.id || i}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                    >
                      {a.title || a.name || a.description || JSON.stringify(a)}
                      {a.year ? ` (${a.year})` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(profile.matches) && profile.matches.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ndeshje</h2>
                <ul className="space-y-2">
                  {profile.matches.slice(0, 12).map((m, i) => (
                    <li
                      key={m.id || i}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                    >
                      {m.opponent || m.title || m.competition || 'Ndeshje'}
                      {m.score != null ? ` · ${m.score}` : ''}
                      {m.date ? ` · ${m.date}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.contact && Object.keys(profile.contact).length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Kontakt</h2>
                <div className="space-y-2 text-sm text-slate-700">
                  {profile.contact.phone && <div>📱 {profile.contact.phone}</div>}
                  {profile.contact.email && <div>📧 {profile.contact.email}</div>}
                  {profile.contact.website && (
                    <div>
                      🌐{' '}
                      <a
                        href={profile.contact.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline"
                      >
                        {profile.contact.website}
                      </a>
                    </div>
                  )}
                  {profile.contact.instagram && <div>📸 {profile.contact.instagram}</div>}
                  {profile.contact.twitter && <div>🐦 {profile.contact.twitter}</div>}
                  {profile.contact.facebook && <div>👍 {profile.contact.facebook}</div>}
                </div>
              </section>
            )}
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ndaj CV-në</h2>
          <p className="mt-1 text-sm text-slate-600">Facebook, X, WhatsApp ose kopjo linkun.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <FacebookShareButton url={shareUrl} quote={shareText}>
              <FacebookIcon size={40} round />
            </FacebookShareButton>
            <TwitterShareButton url={shareUrl} title={shareText}>
              <TwitterIcon size={40} round />
            </TwitterShareButton>
            <WhatsappShareButton url={shareUrl} title={shareText} separator=" ">
              <WhatsappIcon size={40} round />
            </WhatsappShareButton>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? 'U kopjua' : 'Kopjo linkun'}
            </button>
          </div>
          <p className="mt-3 break-all text-xs text-slate-400">{shareUrl}</p>
        </section>

        <div className="mt-6 flex flex-wrap justify-center gap-3 pb-10">
          <Link
            to={`/profile/${profile.id}`}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Hap profilin e plotë
          </Link>
          <Link
            to="/register"
            className="rounded-full border border-emerald-700 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Bashkohu në {APP_BRAND_NAME}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default PublicCvPage;
