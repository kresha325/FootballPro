import React from 'react';
import { getFullUrl, getVideoPosterUrl, isVideoMedia } from '../../utils/mediaUrl';
import { formatTotalsPoints } from '../../utils/tournamentPoints';

const hasValue = (value) => value !== null && value !== undefined && value !== '';
const numberValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function Section({ title, eyebrow, action, children }) {
  return (
    <section className="xt-card p-4 sm:p-6">
      <div className="xt-section-header">
        <div>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">{eyebrow}</p>}
          <h2 className="mt-1 text-xl font-semibold text-[var(--xt-color-text)]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="xt-empty-state rounded-lg border border-dashed border-[var(--xt-color-border-strong)] px-4 py-8 text-sm">{children}</div>;
}

/** Last 5 / last 10 only when they are a smaller slice than the career total already shown above. */
function FormWindows({ form, careerAppearances }) {
  const careerN = Number(careerAppearances) || 0;
  const windows = [
    ['5 ndeshjet e fundit', form?.last5],
    ['10 ndeshjet e fundit', form?.last10],
  ].filter(([, row]) => row && Number(row.appearances) > 0 && Number(row.appearances) < careerN);
  if (!windows.length) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {windows.map(([label, row]) => (
        <div key={label} className="rounded-lg border border-[var(--xt-color-border)] p-3 text-sm">
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-[var(--xt-color-text-muted)]">{row.goals ?? 0} gola · {row.assists ?? 0} asiste · {row.minutes ?? 0} min</p>
        </div>
      ))}
    </div>
  );
}

const PlayerProfile = ({ profile, tournamentSummary, gallery = [], onShowVideos, onShowGallery }) => {
  const stats = profile?.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const tournaments = Array.isArray(tournamentSummary?.tournaments) ? tournamentSummary.tournaments : [];
  const totals = tournamentSummary?.totals || {};
  const matches = Array.isArray(profile?.matches) ? profile.matches : [];
  const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];
  const official = profile?.performance?.career;
  const hasOfficial = profile?.statisticsSource === 'matches' && official;
  const performance = hasOfficial
    ? [
        { label: 'Ndeshje', value: official.appearances },
        { label: 'Titullar', value: official.starts },
        { label: 'Minuta', value: official.minutes },
        { label: 'Gola', value: official.goals },
        { label: 'Asiste', value: official.assists },
        { label: 'Kartona', value: (Number(official.yellowCards) || 0) + (Number(official.redCards) || 0) },
        { label: 'Fitore', value: official.wins },
        { label: 'Vlerësimi', value: official.rating },
        { label: 'Pikë', value: totals && (totals.points != null || totals.pointsPossible != null) ? formatTotalsPoints(totals) : null },
      ].filter((item) => item.value !== null && item.value !== undefined)
    : [];
  const identity = [
    ['Pozicioni', profile?.position],
    ['Pozicione të tjera', Array.isArray(stats.secondaryPositions) ? stats.secondaryPositions.join(', ') : null],
    ['Këmba e preferuar', stats.preferredFoot],
    ['Gjatësia', hasValue(stats.height) ? `${stats.height} cm` : null],
    ['Pesha', hasValue(stats.weight) ? `${stats.weight} kg` : null],
    ['Numri', hasValue(stats.jerseyNumber) ? `#${stats.jerseyNumber}` : null],
    ['Ekipi', stats.currentTeam],
    ['Niveli', stats.playingLevel],
    ['Kategoria', stats.footballCategory],
    ['Statusi', stats.youthSenior],
    ['Mosha', profile?.age != null ? String(profile.age) : null],
    ['Shtetësia', stats.nationality || profile?.country],
    ['Qyteti', profile?.city],
    ['Klubi aktual', profile?.club],
    ['Agjenti', stats.agentName],
    ['Agjencia', stats.agencyName],
  ].filter(([, value]) => hasValue(value));
  const videos = gallery.filter(isVideoMedia);
  const career = profile?.careerHistory;
  const careerText = typeof career === 'string' ? career.trim() : '';
  const careerRows = Array.isArray(career) ? career : [];
  const joinedYear =
    profile?.clubJoinedYear != null &&
    Number(profile.clubJoinedYear) >= 1950 &&
    Number(profile.clubJoinedYear) <= new Date().getFullYear() + 1
      ? Number(profile.clubJoinedYear)
      : null;
  const syntheticCareer =
    !careerRows.length &&
    !careerText &&
    profile?.club &&
    joinedYear
      ? [{ club: profile.club, season: `nga ${joinedYear} · vazhdon`, ongoing: true }]
      : [];
  const displayCareerRows = careerRows.length ? careerRows : syntheticCareer;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {(profile?.bio || stats.footballJourney || stats.strengths || stats.playingStyle || stats.objectives) && (
        <Section title="Bio" eyebrow="Lojtari">
          {profile?.bio && <p className="whitespace-pre-wrap leading-relaxed text-[var(--xt-color-text-muted)]">{profile.bio}</p>}
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ['Rruga futbollistike', stats.footballJourney],
              ['Pikat e forta', stats.strengths],
              ['Stili i lojës', stats.playingStyle],
              ['Objektivat', stats.objectives],
            ].filter(([, value]) => hasValue(value)).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--xt-color-text-subtle)]">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-[var(--xt-color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section title="Performanca" eyebrow={hasOfficial ? 'Nga ndeshjet zyrtare' : 'Përmbledhje e karrierës'}>
        {performance.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {performance.map((item) => (
              <div className="xt-stat-card" key={item.label}>
                <div className="text-2xl font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{item.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--xt-color-text-muted)]">{item.label}</div>
              </div>
            ))}
          </div>
        ) : <Empty>Statistikat e ndeshjeve do të shfaqen këtu kur të regjistrohen nga ndeshjet.</Empty>}
        {hasOfficial && (
          <FormWindows form={profile.performance?.form} careerAppearances={official.appearances} />
        )}
      </Section>

      <Section title="Identiteti i lojtarit" eyebrow="Të dhënat kryesore">
        {identity.length ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {identity.map(([label, value]) => (
              <div key={label} className="border-b border-[var(--xt-color-border)] pb-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--xt-color-text-subtle)]">{label}</dt>
                <dd className="mt-1 font-medium text-[var(--xt-color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : <Empty>Informacioni i lojtarit nuk është shtuar ende.</Empty>}
      </Section>

      <Section title="Karriera" eyebrow="Klube dhe sezone">
        {displayCareerRows.length ? (
          <ol className="space-y-3">
            {displayCareerRows.map((entry, index) => {
              const row = typeof entry === 'string' ? { club: entry } : entry || {};
              const name = row.club || row.clubName || row.team || row.name || row.competition || 'Klub';
              const meta = [row.season, row.team, row.competition, row.position, hasValue(row.jerseyNumber) ? `#${row.jerseyNumber}` : null].filter(Boolean).join(' · ');
              const showLineStats = displayCareerRows.length > 1;
              const lineStats = showLineStats
                ? [row.appearances != null ? `${row.appearances} ndeshje` : null, row.goals != null ? `${row.goals} gola` : null, row.assists != null ? `${row.assists} asiste` : null].filter(Boolean).join(' · ')
                : '';
              return <li key={row.id || `${name}-${index}`} className="flex gap-3 rounded-lg border border-[var(--xt-color-border)] p-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--xt-color-gold)]"/><div><p className="font-semibold">{name}</p>{meta && <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{meta}</p>}{lineStats && <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{lineStats}</p>}</div></li>;
            })}
          </ol>
        ) : careerText ? (
          <p className="whitespace-pre-wrap leading-relaxed text-[var(--xt-color-text-muted)]">{careerText}</p>
        ) : <Empty>Historia e klubeve dhe sezoneve do të shfaqet kur të plotësohet.</Empty>}
      </Section>

      <Section title="Ndeshjet e fundit" eyebrow="Historiku">
        {matches.length ? (
          <div className="xt-table-wrap rounded-lg border border-[var(--xt-color-border)]">
            <table className="xt-table min-w-[620px]">
              <thead><tr><th>Ndeshja</th><th>Gara</th><th>Rezultati</th><th>Data</th><th>G/A</th></tr></thead>
              <tbody>{matches.slice(0, 8).map((match, index) => (
                <tr key={match.id || index}>
                  <td className="font-semibold text-[var(--xt-color-text)]">{match.opponent || match.title || match.homeTeam || match.name || 'Ndeshje'}</td>
                  <td>{match.competition || match.tournament || '—'}</td>
                  <td>{match.score || match.result || '—'}</td>
                  <td>{match.date ? new Date(match.date).toLocaleDateString() : '—'}</td>
                  <td>{[hasValue(match.goals) ? `${match.goals} G` : null, hasValue(match.assists) ? `${match.assists} A` : null].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty>Nuk ka ndeshje të regjistruara ende.</Empty>}
      </Section>

      <Section title="Highlights" eyebrow="Video dhe momente" action={gallery.length > 0 && <button type="button" onClick={onShowGallery} className="btn btn-outline">Hap galerinë</button>}>
        {videos.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.slice(0, 3).map((video, index) => {
              const poster = video.thumbnail || video.thumbnailUrl || (video.imageUrl && !isVideoMedia(video.imageUrl) ? video.imageUrl : getVideoPosterUrl(video.videoUrl || video.imageUrl));
              return <button type="button" key={video.id || index} onClick={onShowVideos || onShowGallery} className="group relative aspect-video overflow-hidden rounded-lg border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] text-left">
                {poster ? <img src={getFullUrl(poster)} alt={video.title || 'Video highlight'} className="h-full w-full object-cover transition-transform group-hover:scale-105"/> : <div className="flex h-full items-center justify-center text-3xl text-[var(--xt-color-gold-bright)]">▶</div>}
                <span className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-sm font-medium text-white">{video.title || video.matchContext || 'Highlight'}</span>
              </button>;
            })}
          </div>
        ) : <Empty>{gallery.length ? 'Media e profilit është në galeri.' : 'Videot dhe momentet e lojës do të shfaqen këtu.'}</Empty>}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Arritjet" eyebrow="Çmime dhe turne">
          {achievements.length ? <ul className="space-y-3">{achievements.slice(0, 8).map((item, index) => <li key={item.tournamentId || item.title || index} className="flex items-start gap-3 rounded-lg border border-[var(--xt-color-border)] p-3"><span className="xt-badge xt-badge-gold">{item.season || item.year || 'Arritje'}</span><span><span className="font-medium">{item.title || item.name}</span>{item.competition ? <span className="mt-1 block text-sm text-[var(--xt-color-text-muted)]">{item.competition}</span> : null}</span></li>)}</ul> : <Empty>Arritjet dhe çmimet do të shfaqen kur të shtohen.</Empty>}
          {profile?.scouting && (
            <div className="mt-4 rounded-lg border border-[var(--xt-color-border)] p-3 text-sm">
              <p className="font-semibold">Skautimi</p>
              <p className="mt-1 text-[var(--xt-color-text-muted)]">
                Plotësia {profile.scouting.completeness?.percent ?? 0}% · {profile.scouting.position || 'pa pozicion'} · {profile.scouting.club || 'pa klub'}
              </p>
            </div>
          )}
        </Section>
        <Section title="Turnet" eyebrow="Pjesëmarrja">
          {tournaments.length ? (
            <ul className="space-y-3">
              {tournaments.slice(0, 6).map((item, index) => {
                const categoryLabel = item.tournamentCategory || item.category;
                const categoryText =
                  categoryLabel && String(categoryLabel).toLowerCase() !== 'open'
                    ? String(categoryLabel).toUpperCase()
                    : null;
                return (
                  <li
                    key={item.id || item.tournamentId || index}
                    className="flex items-center justify-between gap-4 rounded-lg border border-[var(--xt-color-border)] p-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.name || item.tournamentName || item.title || 'Turne'}
                        {categoryText ? (
                          <span className="ml-2 text-sm font-semibold text-[var(--xt-color-gold-bright)]">
                            {categoryText}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-[var(--xt-color-text-muted)]">
                        {[
                          categoryText,
                          item.tournamentDescription || item.description,
                          item.season || item.tournamentSeason,
                          item.played != null ? `${item.played} ndeshje` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {hasValue(item.rank) && <span className="xt-badge xt-badge-gold">#{item.rank}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Nuk ka pjesëmarrje në turne për t'u shfaqur.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
};

export default PlayerProfile;
