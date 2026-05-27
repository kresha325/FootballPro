import React, { useState, useEffect } from 'react';
import { clubMembersAPI, clubStaffAPI } from '../../services/api';
import { Link } from 'react-router-dom';

const ClubProfile = ({ profile = {}, isOwner }) => {
  const clubData = (profile && profile.stats) ? profile.stats : {};

  // Helper for absolute/relative URL
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');

  // Helper për path të plotë të fotove/video
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    if (/(^|\/)default-avatar\.png$/i.test(normalized)) return '/default-avatar.svg';
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  const [clubMembers, setClubMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [clubStaff, setClubStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const squadSize = loadingMembers ? '...' : clubMembers.length;

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

  const groupedMembers = clubMembers.reduce((acc, member) => {
    const teamType = member.teamType ? teamTypeLabels[member.teamType] || member.teamType : null;
    const ageGroup = member.athlete?.Profile?.ageGroup || 'Pa grupmoshë';
    const groupKey = teamType || ageGroup;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(member);
    return acc;
  }, {});

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
    <div className="space-y-6">
      {/* Profile Photo */}
      {profile.profilePhoto && (
        <div className="flex justify-center mb-6">
          <img
            src={getFullUrl(profile.profilePhoto)}
            alt="Profile"
            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
          />
        </div>
      )}
      {/* Gallery Photos */}
      {Array.isArray(profile.gallery) && profile.gallery.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🖼️</span> Galeria e klubit
          </h3>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎥</span> Videot e klubit
          </h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Club Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Founded</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.founded || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Stadium</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.stadium || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Capacity</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.capacity?.toLocaleString() || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">League</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{clubData.league || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Club Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">🏆</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.trophies || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trophies</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">👥</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{squadSize}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Squad Size</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">📊</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.ranking || 'N/A'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">League Ranking</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">💰</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clubData.marketValue || 'N/A'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Market Value</div>
          </div>
        </div>
      </div>

      {/* About Club */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>ℹ️</span> About {profile.club || 'Club'}
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Club Staff */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <span>🧑‍🏫</span> Trajnerët e klubit
        </h3>
        {loadingStaff ? (
          <div className="text-gray-500 dark:text-gray-400">Duke ngarkuar...</div>
        ) : clubStaff.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">Nuk ka trajnerë ende.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubStaff.map((staff) => (
              <div key={staff.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                {staff.staff?.Profile?.profilePhoto ? (
                  <img
                    src={getFullUrl(staff.staff.Profile.profilePhoto)}
                    alt={`${staff.staff?.firstName} ${staff.staff?.lastName}`}
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    {`${staff.staff?.firstName?.[0] || ''}${staff.staff?.lastName?.[0] || ''}`}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {staff.staff?.firstName} {staff.staff?.lastName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {staffRoleLabels[staff.staffRole] || staff.staffRole || 'Trajner'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending membership requests */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⏳</span> Kërkesa në pritje
          </h3>
          {loadingPending ? (
            <div className="text-gray-500 dark:text-gray-400">Duke ngarkuar...</div>
          ) : pendingMembers.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">Nuk ka kërkesa në pritje.</div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {member.athlete?.firstName} {member.athlete?.lastName}
                    </div>
                    {member.position && (
                      <div className="text-sm text-gray-500">{member.position}</div>
                    )}
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
      {!loadingMembers && clubMembers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚽</span> Skuadra
          </h3>
          <div className="space-y-6">
            {Object.entries(groupedMembers).map(([group, members]) => (
              <div key={group}>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{group}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((member) => (
                    <Link
                      key={member.id}
                      to={`/profile/${member.athlete?.id || member.userId}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        {`${member.athlete?.firstName?.[0] || ''}${member.athlete?.lastName?.[0] || ''}`}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {member.athlete?.firstName} {member.athlete?.lastName}
                        </div>
                        {member.jerseyNumber != null && (
                          <div className="text-xs text-gray-500">#{member.jerseyNumber}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Club Roster */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
            <span>👥</span> Club Roster
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Menaxho kërkesat dhe anëtarët e klubit në faqen e dedikuar.
          </p>
          <Link
            to="/club-roster"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            Shko te Club Roster
          </Link>
        </div>
      )}

      {/* Achievements & Honors */}
      {clubData.achievements && clubData.achievements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏅</span> Achievements & Honors
          </h3>
          <div className="space-y-3">
            {clubData.achievements.map((achievement, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="text-3xl">🏆</div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{achievement.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{achievement.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Colors */}
      {clubData.colors && clubData.colors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📞</span> Contact Information
          </h3>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubProfile;
