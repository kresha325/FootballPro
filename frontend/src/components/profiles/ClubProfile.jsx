import React, { useState, useEffect } from 'react';
import { clubMembersAPI, clubStaffAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { getFullUrl } from '../../utils/mediaUrl';
import MediaSection from '../media/MediaSection';

const ClubProfile = ({ profile = {}, isOwner }) => {
  const clubData = (profile && profile.stats) ? profile.stats : {};

  const [clubMembers, setClubMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [clubStaff, setClubStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const staffRoleLabels = {
    president: 'President',
    vice_president: 'Vice President',
    chairman: 'Chairman',
    ceo: 'CEO',
    general_manager: 'General Manager',
    sporting_director: 'Sporting Director',
    technical_director: 'Technical Director',
    director_of_football: 'Director of Football',
    academy_director: 'Academy Director',
    youth_director: 'Youth Director',
    team_manager: 'Team Manager',
    secretary_general: 'Secretary General',
    secretary: 'Secretary',
    head_coach: 'Head Coach',
    assistant_coach: 'Assistant Coach',
    fitness_coach: 'Fitness Coach',
    goalkeeper_coach: 'Goalkeeper Coach',
    technical_coach: 'Technical Coach',
    tactical_coach: 'Tactical Coach',
    medical_staff: 'Medical Staff',
    doctor: 'Doctor',
    assistant_doctor: 'Assistant Doctor',
    physiotherapist: 'Physiotherapist',
    sports_psychologist: 'Sports Psychologist',
    nutritionist: 'Nutritionist',
    masseur: 'Masseur',
    scout: 'Scout',
    analyst: 'Analyst',
    video_analyst: 'Video Analyst',
    media_officer: 'Media Officer',
    security_officer: 'Security Officer',
    logistics_manager: 'Logistics Manager',
    kit_manager: 'Kit Manager',
    equipment_manager: 'Equipment Manager',
    groundskeeper: 'Groundskeeper',
    other: 'Other',
  };

  const teamTypeLabels = {
    first_team: 'First Team',
    men: 'Men',
    women: 'Women',
    youth: 'Youth',
    u23: 'U23',
    u21: 'U21',
    u19: 'U19',
    u17: 'U17',
    u15: 'U15',
    u13: 'U13',
    u11: 'U11',
    u9: 'U9',
  };

  const competitionCategoryLabels = {
    open: 'Open',
    senior: 'Senior',
    u23: 'U23',
    u21: 'U21',
    u19: 'U19',
    u17: 'U17',
    u15: 'U15',
    u13: 'U13',
    u11: 'U11',
    u10: 'U10',
    u9: 'U9',
  };

  const isAthleteMember = (member) => {
    const role = String(member?.athlete?.role || '').toLowerCase();
    return !role || role === 'athlete';
  };

  const athleteMembers = clubMembers.filter(isAthleteMember);
  const squadSize = loadingMembers ? '...' : athleteMembers.length;
  const clubMetrics = [
    { label: 'Lojtarë në skuadër', value: squadSize },
    { label: 'Ekipe', value: loadingMembers ? '…' : new Set(athleteMembers.map((member) => member.teamType).filter(Boolean)).size },
    { label: 'Staf aktiv', value: loadingStaff ? '…' : clubStaff.length },
    { label: 'Trofe', value: clubData.trophies },
    { label: 'Pozita në ligë', value: clubData.ranking },
    { label: 'Vlera e tregut', value: clubData.marketValue },
  ].filter((metric) => metric.value !== null && metric.value !== undefined && metric.value !== '');

  const groupByTeam = (items, getTeamType) =>
    items.reduce((acc, item) => {
      const raw = getTeamType(item);
      const groupKey = raw ? teamTypeLabels[raw] || raw : 'Pa kategori';
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {});

  const groupedMembers = groupByTeam(athleteMembers, (m) => m.teamType);
  const groupedStaff = groupByTeam(clubStaff, (s) => s.teamType);

  const avatarFallback = (first, last) =>
    `${(first || '?').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();

  const PersonAvatar = ({ photo, firstName, lastName }) => {
    if (photo) {
      return (
        <img
          src={getFullUrl(photo)}
          alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Avatar'}
          className="xt-avatar h-12 w-12 object-cover"
          loading="lazy"
          decoding="async"
        />
      );
    }
    return (
      <div
        className="xt-avatar h-12 w-12 text-sm"
      >
        {avatarFallback(firstName, lastName)}
      </div>
    );
  };

  const fetchClubMembers = async () => {
    const clubId = profile.userId || profile.User?.id || profile.id;
    if (!clubId) return;
    setLoadingMembers(true);
    try {
      const res = await clubMembersAPI.getClubMembers(clubId, 'approved');
      setClubMembers(res.data || []);
    } catch (err) {
      setClubMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchPendingMembers = async () => {
    if (!isOwner) return;
    const clubId = profile.userId || profile.User?.id || profile.id;
    if (!clubId) return;
    setLoadingPending(true);
    try {
      const res = await clubMembersAPI.getClubMembers(clubId, 'pending');
      setPendingMembers(res.data || []);
    } catch (err) {
      setPendingMembers([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchClubStaff = async () => {
    const clubId = profile.userId || profile.User?.id || profile.id;
    if (!clubId) return;
    setLoadingStaff(true);
    try {
      const res = await clubStaffAPI.getClubStaff(clubId, { status: 'active' });
      setClubStaff(res.data || []);
    } catch (err) {
      setClubStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (profile.userId || profile.id) {
      fetchClubMembers();
      fetchPendingMembers();
      fetchClubStaff();
    }
  }, [profile.userId, profile.id, isOwner]);

  const handleMembershipDecision = async (membershipId, status) => {
    try {
      await clubMembersAPI.updateMembershipStatus(membershipId, status);
      await fetchClubMembers();
      await fetchPendingMembers();
    } catch (err) {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <section className="xt-card overflow-hidden">
        <div className="h-1.5 bg-[var(--xt-color-gold)]" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="xt-avatar h-20 w-20 overflow-hidden rounded-xl text-2xl">
            {profile.profilePhoto ? <img src={getFullUrl(profile.profilePhoto)} alt={`${profile.club || 'Klubi'} logo`} className="h-full w-full object-cover" /> : (profile.club || 'KL').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">Klub futbolli</p>
            <h2 className="mt-1 text-2xl font-bold">{profile.club || 'Organizata e klubit'}</h2>
            <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{[profile.city, profile.country].filter(Boolean).join(', ') || 'Vendndodhja nuk është shtuar'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.verified && <span className="xt-badge xt-badge-gold">I verifikuar</span>}
              {clubData.clubType && <span className="xt-badge">{clubData.clubType}</span>}
            </div>
          </div>
          {isOwner && <Link to="/club-roster" className="btn btn-primary">Hap menaxhimin e klubit</Link>}
        </div>
      </section>
      {/* Gallery Photos */}
      {Array.isArray(profile.gallery) && profile.gallery.length > 0 && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)]">Galeria e klubit</h3>
          <div className="flex flex-wrap gap-4">
            {profile.gallery.map((img, idx) => (
              <img
                key={idx}
                src={getFullUrl(img)}
                alt={`Gallery ${idx+1}`}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Club Videos */}
      {Array.isArray(profile.videos) && profile.videos.length > 0 && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)]">Videot e klubit</h3>
          <div className="flex flex-wrap gap-4">
            {profile.videos.map((vid, idx) => (
              <video
                key={idx}
                src={getFullUrl(vid)}
                controls
                className="w-64 h-36 rounded-lg border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Club Information */}
      <div className="xt-card p-4 sm:p-6">
        <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)]">Informacioni i klubit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-[var(--xt-color-text-muted)]">Founded</label>
            <p className="text-lg font-semibold text-[var(--xt-color-text)] mt-1">
              {profile.founded || clubData.founded || profile.foundingYear || 'Nuk është shtuar'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--xt-color-text-muted)]">Stadium</label>
            <p className="text-lg font-semibold text-[var(--xt-color-text)] mt-1">
              {profile.stadium || clubData.stadium || 'Nuk është shtuar'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--xt-color-text-muted)]">Capacity</label>
            <p className="text-lg font-semibold text-[var(--xt-color-text)] mt-1">
              {(profile.capacity ?? clubData.capacity) != null &&
              String(profile.capacity ?? clubData.capacity) !== ''
                ? Number(profile.capacity ?? clubData.capacity).toLocaleString()
                : 'Nuk është shtuar'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--xt-color-text-muted)]">
              {Array.isArray(profile.joinedLigas) && profile.joinedLigas.length > 1 ? 'Ligat' : 'Liga'}
            </label>
            {Array.isArray(profile.joinedLigas) && profile.joinedLigas.length > 0 ? (
              <ul className="mt-1 space-y-1.5">
                {profile.joinedLigas.map((liga) => {
                  const lid = liga.userId || liga.id;
                  const logo = getFullUrl(liga.logo);
                  return (
                    <li key={lid || liga.ligaId || liga.name} className="flex items-center gap-2">
                      {logo ? (
                        <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--xt-color-surface-raised)] flex items-center justify-center text-xs font-bold text-[var(--xt-color-text-muted)] shrink-0">
                          {String(liga.name || 'L').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {lid ? (
                        <Link
                          to={`/profile/${lid}`}
                          className="text-lg font-semibold text-[var(--xt-color-text)] hover:text-[var(--xt-color-gold-bright)] hover:underline truncate"
                        >
                          {liga.name}
                        </Link>
                      ) : (
                        <span className="text-lg font-semibold text-[var(--xt-color-text)] truncate">
                          {liga.name}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-lg font-semibold text-[var(--xt-color-text)] mt-1">
                {profile.league || clubData.league || 'Nuk është shtuar'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Club Statistics */}
      {clubMetrics.length > 0 && (
        <section className="xt-card p-4 sm:p-6">
          <div className="xt-section-header"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--xt-color-gold-bright)]">Përmbledhje</p><h3 className="mt-1 text-xl font-semibold">Të dhënat e klubit</h3></div></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {clubMetrics.map((metric) => <div className="xt-stat-card" key={metric.label}><p className="text-2xl font-bold tabular-nums text-[var(--xt-color-gold-bright)]">{metric.value}</p><p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">{metric.label}</p></div>)}
          </div>
        </section>
      )}

      {/* About Club */}
      {profile.bio && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)]">Rreth {profile.club || 'klubit'}</h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Club Staff */}
      <div className="xt-card p-4 sm:p-6">
        <h3 className="text-xl font-bold mb-1 text-[var(--xt-color-text)] flex items-center gap-2">
          Stafi teknik dhe drejtues
        </h3>
        <p className="text-sm text-[var(--xt-color-text-muted)] mb-4">
          Sipas kategorisë së ekipit dhe rolit — klikoni për profilin.
        </p>
        {loadingStaff ? (
          <div className="text-[var(--xt-color-text-muted)]">Duke ngarkuar...</div>
        ) : clubStaff.length === 0 ? (
          <div className="text-[var(--xt-color-text-muted)]">Nuk ka staf aktiv ende.</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedStaff).map(([group, staffList]) => (
              <div key={group}>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium xt-badge xt-badge-gold">
                    {group}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">{staffList.length}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {staffList.map((staff) => {
                    const staffUser = staff.staff;
                    const staffId = staffUser?.id || staff.staffId;
                    const card = (
                      <>
                        <PersonAvatar
                          photo={staffUser?.Profile?.profilePhoto}
                          firstName={staffUser?.firstName}
                          lastName={staffUser?.lastName}
                          tone="green"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--xt-color-text)] truncate">
                            {staffUser?.firstName} {staffUser?.lastName}
                          </div>
                          <div className="text-sm text-[var(--xt-color-gold-bright)]">
                            {staffRoleLabels[staff.staffRole] || staff.staffRole || 'Staff'}
                          </div>
                        </div>
                      </>
                    );
                    const className =
                      'xt-card flex items-center gap-3 p-3 transition-colors hover:border-[var(--xt-color-gold)]';
                    return staffId ? (
                      <Link key={staff.id} to={`/profile/${staffId}`} className={className}>
                        {card}
                      </Link>
                    ) : (
                      <div key={staff.id} className={className}>
                        {card}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending membership requests */}
      {isOwner && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)] flex items-center gap-2">
            <span>⏳</span> Kërkesa në pritje
          </h3>
          {loadingPending ? (
            <div className="text-[var(--xt-color-text-muted)]">Duke ngarkuar...</div>
          ) : pendingMembers.filter(isAthleteMember).length === 0 ? (
            <div className="text-[var(--xt-color-text-muted)]">Nuk ka kërkesa në pritje.</div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.filter(isAthleteMember).map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-[var(--xt-color-border)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <PersonAvatar
                      photo={member.athlete?.Profile?.profilePhoto}
                      firstName={member.athlete?.firstName}
                      lastName={member.athlete?.lastName}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--xt-color-text)]">
                        {member.athlete?.firstName} {member.athlete?.lastName}
                      </div>
                      <div className="text-xs text-[var(--xt-color-gold-bright)] font-medium">Atlet</div>
                      {member.position && (
                        <div className="text-sm text-gray-500">{member.position}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleMembershipDecision(member.id, 'approved')}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Aprovo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMembershipDecision(member.id, 'rejected')}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Refuzo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Squad by group */}
      <div className="xt-card p-4 sm:p-6">
        <h3 className="text-xl font-bold mb-1 text-[var(--xt-color-text)]">Skuadra e lojtarëve</h3>
        <p className="text-sm text-[var(--xt-color-text-muted)] mb-4">
          Të ndarë sipas ekipit / kategorisë — klikoni për profilin.
        </p>
        {loadingMembers ? (
          <div className="text-[var(--xt-color-text-muted)]">Duke ngarkuar...</div>
        ) : athleteMembers.length === 0 ? (
          <div className="text-[var(--xt-color-text-muted)]">Nuk ka atletë të aprovuar ende.</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMembers).map(([group, members]) => (
              <div key={group}>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium xt-badge">
                    {group}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">{members.length}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((member) => {
                    const athleteId = member.athlete?.id || member.athleteId;
                    const position =
                      member.position || member.athlete?.Profile?.position || null;
                    const jersey =
                      member.jerseyNumber ??
                      member.athlete?.Profile?.stats?.jerseyNumber ??
                      null;
                    const competition =
                      competitionCategoryLabels[member.competitionCategory] ||
                      member.competitionCategory ||
                      null;
                    const ageGroup = member.athlete?.Profile?.ageGroup || null;
                    return (
                      <Link
                        key={member.id}
                        to={`/profile/${athleteId}`}
                        className="xt-card flex items-center gap-3 p-3 transition-colors hover:border-[var(--xt-color-gold)]"
                      >
                        <PersonAvatar
                          photo={member.athlete?.Profile?.profilePhoto}
                          firstName={member.athlete?.firstName}
                          lastName={member.athlete?.lastName}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--xt-color-text)] truncate">
                            {member.athlete?.firstName} {member.athlete?.lastName}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Atlet
                            </span>
                            {competition && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200">
                                Ligë: {competition}
                              </span>
                            )}
                            {ageGroup && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200">
                                {ageGroup}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {[position, jersey != null && jersey !== '' ? `#${jersey}` : null]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Club Roster */}
      {isOwner && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-2 text-[var(--xt-color-text)]">Skuadra e klubit</h3>
          <p className="text-sm text-[var(--xt-color-text-muted)] mb-4">
            Menaxho kërkesat dhe anëtarët e klubit në faqen e dedikuar.
          </p>
          <Link
            to="/club-roster"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            Hap menaxhimin e klubit
          </Link>
        </div>
      )}

      {/* Achievements & Honors */}
      {clubData.achievements && clubData.achievements.length > 0 && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)] flex items-center gap-2">
            <span>🏅</span> Achievements & Honors
          </h3>
          <div className="space-y-3">
            {clubData.achievements.map((achievement, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="text-3xl">🏆</div>
                <div>
                  <h4 className="font-semibold text-[var(--xt-color-text)]">{achievement.title}</h4>
                  <p className="text-sm text-[var(--xt-color-text-muted)]">{achievement.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Colors */}
      {clubData.colors && clubData.colors.length > 0 && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)] flex items-center gap-2">
            <span>🎨</span> Team Colors
          </h3>
          <div className="flex gap-3">
            {clubData.colors.map((color, index) => (
              <div
                key={index}
                className="w-20 h-20 rounded-lg shadow-md border-2 border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: color }}
                title={color}
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* Contact & Social */}
      {profile.contact && (
        <div className="xt-card p-4 sm:p-6">
          <h3 className="text-xl font-bold mb-4 text-[var(--xt-color-text)]">Kontakti</h3>
          <div className="space-y-3">
            {profile.contact.phone && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.phone}</span>
              </div>
            )}
            {profile.contact.email && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.email}</span>
              </div>
            )}
            {profile.contact.website && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <a href={profile.contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {profile.contact.website}
                </a>
              </div>
            )}
            {profile.contact.instagram && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📸</span>
                <a
                  href={`https://instagram.com/${String(profile.contact.instagram).replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {profile.contact.instagram}
                </a>
              </div>
            )}
            {profile.contact.facebook && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">👍</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.facebook}</span>
              </div>
            )}
            {profile.contact.twitter && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐦</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.twitter}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <MediaSection
          context="club"
          entityId={profile.userId || profile.User?.id || profile.id}
          canManage={!!isOwner}
          title="Media e klubit"
          defaults={{
            clubId: profile.userId || profile.User?.id || profile.id,
          }}
        />
      </div>
    </div>
  );
}

export default ClubProfile;
