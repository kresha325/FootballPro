import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { getFullUrl, getGalleryMediaUrl, getVideoPosterUrl, isVideoMedia } from '../utils/mediaUrl';
import { getFoundingYear, isOrgProfileRole } from '../utils/orgProfile';
import { APP_BRAND_NAME, APP_BRAND_WORDMARK, APP_LOGO_SRC } from '../config/branding';
import { getProfileCvShareText, getProfileCvShareUrl } from '../utils/shareProfile';
import { useAuth } from '../contexts/AuthContext';
import ShareChannelsPanel from './ShareChannelsPanel';

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
  return ROLE_LABELS[String(role || '').toLowerCase()] || role || 'Profil';
}

function StatPill({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur-sm ring-1 ring-white/15">
      <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/90">
        {label}
      </div>
    </div>
  );
}

function PublicCvPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

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
  const profileId = profile?.id || profile?.userId || id;
  const profilePath = profile?.profilePath || `/profile/${profileId}`;
  const isOwner =
    user != null && profile != null && Number(user.id) === Number(profileId);

  useEffect(() => {
    if (!profile) return undefined;
    const prev = document.title;
    document.title = `${displayName} · CV · ${APP_BRAND_NAME}`;
    return () => {
      document.title = prev;
    };
  }, [profile, displayName]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <p className="text-lg text-slate-300">{error || 'Profili nuk u gjet'}</p>
        <Link to="/" className="mt-6 text-emerald-400 hover:underline">
          Kthehu te {APP_BRAND_NAME}
        </Link>
      </div>
    );
  }

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const isOrg = isOrgProfileRole(profile.role);
  const founding = profile.foundingYear || getFoundingYear(profile);
  const gallery = Array.isArray(profile.galleryPreview) ? profile.galleryPreview : [];
  const role = String(profile.role || '').toLowerCase();

  const heroStats = [
    { label: 'Ndjekës', value: profile.followers ?? 0 },
    { label: 'Duke ndjekur', value: profile.following ?? 0 },
    { label: 'Postime', value: profile.postsCount ?? 0 },
    { label: 'Galerie', value: profile.galleryCount ?? gallery.length },
  ];
  if (role === 'club') {
    if (profile.athletesCount != null) heroStats.push({ label: 'Atletë', value: profile.athletesCount });
    if (profile.staffCount != null) heroStats.push({ label: 'Staf', value: profile.staffCount });
  }
  if (role === 'athlete' && profile.tournamentTotals) {
    heroStats.push({ label: 'Turne', value: profile.tournamentTotals.tournamentsPlayed ?? 0 });
    heroStats.push({ label: 'Gola', value: profile.tournamentTotals.goalsFor ?? 0 });
  }

  const detailStats = [
    { label: 'Gjatësia', value: stats.height ? `${stats.height} cm` : null },
    { label: 'Pesha', value: stats.weight ? `${stats.weight} kg` : null },
    { label: 'Numri', value: stats.jerseyNumber ? `#${stats.jerseyNumber}` : null },
    { label: 'Këmba', value: stats.preferredFoot || null },
    { label: 'Stadiumi', value: profile.stadium || stats.stadium || null },
    { label: 'Kapaciteti', value: profile.capacity || stats.capacity || null },
    { label: 'Liga', value: profile.league || stats.league || null },
    { label: 'Themeluar', value: founding || stats.founded || null },
    { label: 'Industria', value: stats.industry || null },
  ].filter((s) => s.value != null && s.value !== '');

  const registerFollowUrl = `/register?next=${encodeURIComponent(profilePath)}`;
  const loginFollowUrl = `/login?next=${encodeURIComponent(profilePath)}`;
  const fullProfileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${profilePath}`
      : `https://xtalenti.com${profilePath}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(15,23,42,0.9), transparent)',
        }}
      />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-wide text-white">
            <img src={APP_LOGO_SRC} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm sm:text-base">
              <span className="text-emerald-400">X</span> {APP_BRAND_WORDMARK}
            </span>
          </Link>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            CV dixhitale
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-16 pt-6">
        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40">
          <div className="relative h-48 sm:h-64">
            {profile.coverPhoto ? (
              <img
                src={getFullUrl(profile.coverPhoto)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-emerald-800 via-slate-900 to-slate-950" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>

          <div className="relative px-5 pb-8 sm:px-8">
            <div className="-mt-14 flex flex-col items-center gap-5 sm:-mt-16 sm:flex-row sm:items-end">
              <img
                src={profile.profilePhoto ? getFullUrl(profile.profilePhoto) : '/default-avatar.svg'}
                alt={displayName}
                className="h-28 w-28 rounded-2xl border-4 border-slate-900 object-cover shadow-xl sm:h-32 sm:w-32"
              />
              <div className="flex-1 text-center sm:pb-1 sm:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {displayName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300">
                    {roleLabel(profile.role)}
                  </span>
                  {profile.position && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
                      {profile.position}
                    </span>
                  )}
                  {isOrg && founding && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
                      Themeluar {founding}
                    </span>
                  )}
                  {!isOrg && profile.age != null && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
                      {profile.age} vjeç{profile.ageGroup ? ` · ${profile.ageGroup}` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {[profile.club, profile.city, profile.country].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {/* Real stats strip */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {heroStats.map((s) => (
                <StatPill key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          </div>
        </section>

        {/* Overview + detail stats */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 lg:col-span-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Overview</h2>
            {profile.bio ? (
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-200">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Nuk ka bio publike ende.</p>
            )}
            {profile.careerHistory && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Karriera</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {profile.careerHistory}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 lg:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Stats</h2>
            {detailStats.length > 0 ? (
              <dl className="mt-4 space-y-3">
                {detailStats.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
                    <dt className="text-sm text-slate-400">{s.label}</dt>
                    <dd className="text-sm font-semibold text-white">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Nuk ka stats shtesë.</p>
            )}
          </section>
        </div>

        {/* Gallery last 5 */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Galerie</h2>
              <p className="mt-1 text-sm text-slate-400">5 mediat e fundit</p>
            </div>
            {(profile.galleryCount || 0) > 5 && (
              <span className="text-xs text-slate-500">+{(profile.galleryCount || 0) - 5} më shumë në profil</span>
            )}
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {gallery.map((item) => {
                const isVideo = isVideoMedia(item);
                const mediaUrl = getGalleryMediaUrl(item);
                const poster =
                  item.thumbnail && !isVideoMedia(item.thumbnail)
                    ? getFullUrl(item.thumbnail)
                    : getVideoPosterUrl(mediaUrl);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightbox({ url: mediaUrl, isVideo, title: item.title || '' })}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-white/10"
                  >
                    {isVideo ? (
                      poster ? (
                        <img
                          src={poster}
                          alt={item.title || ''}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <video
                          src={mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : mediaUrl ? (
                      <img
                        src={mediaUrl}
                        alt={item.title || ''}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">—</div>
                    )}
                    {isVideo && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30">
                          ▶
                        </span>
                      </span>
                    )}
                    {isVideo && (
                      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        VIDEO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nuk ka foto publike në galeri.</p>
          )}
        </section>

        {/* Achievements / matches compact */}
        {(Array.isArray(profile.achievements) && profile.achievements.length > 0) ||
        (Array.isArray(profile.matches) && profile.matches.length > 0) ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {Array.isArray(profile.achievements) && profile.achievements.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Arritje</h2>
                <ul className="mt-4 space-y-2">
                  {profile.achievements.slice(0, 6).map((a, i) => (
                    <li key={a.id || i} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                      {a.title || a.name || a.description}
                      {a.year ? ` · ${a.year}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {Array.isArray(profile.matches) && profile.matches.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Ndeshje</h2>
                <ul className="mt-4 space-y-2">
                  {profile.matches.slice(0, 6).map((m, i) => (
                    <li key={m.id || i} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                      {m.opponent || m.title || m.competition || 'Ndeshje'}
                      {m.score != null ? ` · ${m.score}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : null}

        {/* Contact */}
        {profile.contact && Object.keys(profile.contact).length > 0 && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Kontakt</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-200">
              {profile.contact.phone && (
                <span className="rounded-full bg-white/5 px-3 py-1.5">📱 {profile.contact.phone}</span>
              )}
              {profile.contact.email && (
                <span className="rounded-full bg-white/5 px-3 py-1.5">📧 {profile.contact.email}</span>
              )}
              {profile.contact.website && (
                <a
                  href={profile.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/5 px-3 py-1.5 text-emerald-300 hover:bg-white/10"
                >
                  🌐 Website
                </a>
              )}
              {profile.contact.instagram && (
                <span className="rounded-full bg-white/5 px-3 py-1.5">📸 {profile.contact.instagram}</span>
              )}
            </div>
          </section>
        )}

        {/* More / follow gate */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Për më shumë</h2>
          <p className="mt-2 max-w-xl text-base text-slate-300">
            Postime, ndjekje, mesazhe dhe profili i plotë janë në {APP_BRAND_NAME}.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Linku i profilit</p>
            <p className="mt-1 break-all font-mono text-sm text-emerald-300">{fullProfileUrl}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {isOwner ? (
              <Link
                to={profilePath}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                Hap profilin tënd
              </Link>
            ) : user ? (
              <Link
                to={profilePath}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                Hap profilin & ndiq
              </Link>
            ) : (
              <>
                <Link
                  to={registerFollowUrl}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Hap llogari për ta ndjekur
                </Link>
                <Link
                  to={loginFollowUrl}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Kam llogari — Hyr
                </Link>
              </>
            )}
          </div>
          {!user && !isOwner && (
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Pa llogari nuk mund ta ndjekësh këtë profil. Regjistrohu në xtalenti.com për të vazhduar.
            </p>
          )}
        </section>

        {isOwner && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Ndaj CV-në</h2>
            <p className="mt-2 text-sm text-slate-400">
              Facebook, WhatsApp ose kopjo linkun. Preview-i në FB/WhatsApp vjen nga Open Graph.
            </p>
            <div className="mt-4">
              <ShareChannelsPanel url={shareUrl} text={shareText} />
            </div>
          </section>
        )}
      </main>

      {lightbox && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Mbyll"
        >
          <div
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {lightbox.isVideo ? (
              <video
                src={getFullUrl(lightbox.url)}
                controls
                autoPlay
                playsInline
                className="max-h-[85vh] max-w-[92vw] rounded-lg bg-black"
              />
            ) : (
              <img
                src={getFullUrl(lightbox.url)}
                alt={lightbox.title || ''}
                className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
              />
            )}
          </div>
        </button>
      )}
    </div>
  );
}

export default PublicCvPage;
