import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { useAuth } from '../contexts/AuthContext';
import { clubMembersAPI, clubStaffAPI } from '../services/api';
import { CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

function ClubRoster() {
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [pendingStaffRoles, setPendingStaffRoles] = useState({});
  const [pendingStaffTeams, setPendingStaffTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approved'); // approved, pending, staff
  const [teamFilter, setTeamFilter] = useState('all'); // all, first_team, women, men, youth teams
  const [listSearch, setListSearch] = useState('');
  const [showTeamSelectModal, setShowTeamSelectModal] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [selectedTeamType, setSelectedTeamType] = useState('first_team');

  const teamTypes = [
    { id: 'all', label: 'All Teams', icon: '👥' },
    { id: 'first_team', label: 'First Team', icon: '⭐' },
    { id: 'men', label: 'Men', icon: '👨' },
    { id: 'women', label: 'Women', icon: '👩' },
    { id: 'youth', label: 'Youth', icon: '🎯' },
    { id: 'u23', label: 'U23', icon: '🎯' },
    { id: 'u21', label: 'U21', icon: '🎯' },
    { id: 'u19', label: 'U19', icon: '🎯' },
    { id: 'u17', label: 'U17', icon: '🎯' },
    { id: 'u15', label: 'U15', icon: '🎯' },
    { id: 'u13', label: 'U13', icon: '🎯' },
    { id: 'u11', label: 'U11', icon: '🎯' },
    { id: 'u9', label: 'U9', icon: '🎯' },
  ];

  const staffRoleOptions = [
    { id: 'president', label: 'President' },
    { id: 'vice_president', label: 'Vice President' },
    { id: 'chairman', label: 'Chairman' },
    { id: 'ceo', label: 'CEO' },
    { id: 'general_manager', label: 'General Manager' },
    { id: 'sporting_director', label: 'Sporting Director' },
    { id: 'technical_director', label: 'Technical Director' },
    { id: 'director_of_football', label: 'Director of Football' },
    { id: 'academy_director', label: 'Academy Director' },
    { id: 'youth_director', label: 'Youth Director' },
    { id: 'team_manager', label: 'Team Manager' },
    { id: 'secretary_general', label: 'Secretary General' },
    { id: 'secretary', label: 'Secretary' },
    { id: 'head_coach', label: 'Head Coach' },
    { id: 'assistant_coach', label: 'Assistant Coach' },
    { id: 'fitness_coach', label: 'Fitness Coach' },
    { id: 'goalkeeper_coach', label: 'Goalkeeper Coach' },
    { id: 'technical_coach', label: 'Technical Coach' },
    { id: 'tactical_coach', label: 'Tactical Coach' },
    { id: 'medical_staff', label: 'Medical Staff' },
    { id: 'doctor', label: 'Doctor' },
    { id: 'assistant_doctor', label: 'Assistant Doctor' },
    { id: 'physiotherapist', label: 'Physiotherapist' },
    { id: 'sports_psychologist', label: 'Sports Psychologist' },
    { id: 'nutritionist', label: 'Nutritionist' },
    { id: 'masseur', label: 'Masseur' },
    { id: 'scout', label: 'Scout' },
    { id: 'analyst', label: 'Analyst' },
    { id: 'video_analyst', label: 'Video Analyst' },
    { id: 'media_officer', label: 'Media Officer' },
    { id: 'security_officer', label: 'Security Officer' },
    { id: 'logistics_manager', label: 'Logistics Manager' },
    { id: 'kit_manager', label: 'Kit Manager' },
    { id: 'equipment_manager', label: 'Equipment Manager' },
    { id: 'groundskeeper', label: 'Groundskeeper' },
    { id: 'other', label: 'Other' },
  ];

  const staffRoleLabels = staffRoleOptions.reduce((acc, role) => {
    acc[role.id] = role.label;
    return acc;
  }, {});

  const normalizeGroup = (value) => (value || '').toString().trim().toLowerCase();

  const matchesTeamFilter = (membership) => {
    if (teamFilter === 'all') return true;

    const teamType = membership?.teamType;
    const gender = membership?.athlete?.gender;
    const ageGroup = normalizeGroup(membership?.athlete?.Profile?.ageGroup);

    if (teamType === teamFilter) return true;

    if (teamFilter === 'men') return gender === 'male';
    if (teamFilter === 'women') return gender === 'female';

    if (teamFilter === 'youth') {
      return ageGroup.startsWith('u');
    }

    if (teamFilter === 'first_team') {
      return ageGroup === 'senior' || teamType === 'first_team';
    }

    if (teamFilter.startsWith('u')) {
      return ageGroup === teamFilter;
    }

    return false;
  };

  const approvedMembersFiltered = useMemo(() => {
    const byTeam = members.filter(matchesTeamFilter);
    return filterBySearch(byTeam, listSearch, (m) => [
      m.athlete?.firstName,
      m.athlete?.lastName,
      m.teamType,
      m.athlete?.Profile?.position,
      m.athlete?.Profile?.club,
    ]);
  }, [members, teamFilter, listSearch]);

  useEffect(() => {
    if (user && user.role === 'club') {
      fetchMembers();
    }
  }, [user, activeTab]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      if (activeTab === 'staff') {
        const [activeRes, pendingRes] = await Promise.all([
          clubStaffAPI.getClubStaff(user.id, { status: 'active' }),
          clubStaffAPI.getClubStaff(user.id, { status: 'pending' })
        ]);
        setStaffMembers(activeRes.data || []);
        setPendingStaff(pendingRes.data || []);
        const roleMap = {};
        const teamMap = {};
        (pendingRes.data || []).forEach((staff) => {
          roleMap[staff.id] = staff.staffRole || 'assistant_coach';
          teamMap[staff.id] = staff.teamType || 'first_team';
        });
        setPendingStaffRoles(roleMap);
        setPendingStaffTeams(teamMap);
        return;
      }

      const status = activeTab === 'approved' ? 'approved' : 'pending';
      const response = await clubMembersAPI.getClubMembers(user.id, status);

      if (activeTab === 'approved') {
        setMembers(response.data);
      } else {
        setPendingRequests(response.data);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (membershipId) => {
    // Show team selection modal
    const membership = pendingRequests.find(m => m.id === membershipId);
    setSelectedMembership(membership);
    setShowTeamSelectModal(true);
  };

  const confirmApprove = async () => {
    try {
      // Update membership with team type
      await clubMembersAPI.updateMembershipStatus(selectedMembership.id, 'approved');
      // Update team type
      await clubMembersAPI.updateMember(selectedMembership.id, { teamType: selectedTeamType });
      
      setShowTeamSelectModal(false);
      setSelectedMembership(null);
      setSelectedTeamType('first_team');
      fetchMembers();
      alert('Athlete approved successfully!');
    } catch (error) {
      console.error('Error approving member:', error);
      alert('Failed to approve athlete');
    }
  };

  const handleReject = async (membershipId) => {
    try {
      await clubMembersAPI.updateMembershipStatus(membershipId, 'rejected');
      fetchMembers();
      alert('Request rejected');
    } catch (error) {
      console.error('Error rejecting member:', error);
      alert('Failed to reject request');
    }
  };

  const handleRemove = async (membershipId) => {
    if (!confirm('Are you sure you want to remove this athlete from the club?')) {
      return;
    }

    try {
      await clubMembersAPI.removeMember(membershipId);
      fetchMembers();
      alert('Athlete removed from club');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove athlete');
    }
  };

  const handleApproveStaff = async (staffId) => {
    try {
      await clubStaffAPI.updateStaff(staffId, {
        status: 'active',
        staffRole: pendingStaffRoles[staffId] || undefined,
        teamType: pendingStaffTeams[staffId] || undefined,
      });
      fetchMembers();
      alert('Staff approved successfully!');
    } catch (error) {
      console.error('Error approving staff:', error);
      alert('Failed to approve staff');
    }
  };

  const handleRejectStaff = async (staffId) => {
    try {
      await clubStaffAPI.updateStaff(staffId, { status: 'inactive' });
      fetchMembers();
      alert('Staff request rejected');
    } catch (error) {
      console.error('Error rejecting staff:', error);
      alert('Failed to reject staff request');
    }
  };

  if (user?.role !== 'club') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400">This feature is only available for clubs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white mb-6">
        <h1 className="text-4xl font-bold mb-2">Club Roster Management</h1>
        <p className="text-white/90">Manage your club's athletes and membership requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'approved'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          👥 Squad ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 rounded-lg font-medium transition relative ${
            activeTab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          ⏳ Pending Requests ({pendingRequests.length})
          {pendingRequests.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'staff'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          🧑‍🏫 Staff ({staffMembers.length + pendingStaff.length})
        </button>
      </div>

      {/* Team Type Filter (only for approved) */}
      {activeTab === 'approved' && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {teamTypes.map((team) => (
            <button
              key={team.id}
              onClick={() => setTeamFilter(team.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                teamFilter === team.id
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <span>{team.icon}</span>
              <span>{team.label}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'approved' ? (
        <ListSearchBar
          value={listSearch}
          onChange={setListSearch}
          placeholder="Kërko lojtar në roster…"
        />
      ) : null}

      {/* Approved Members */}
      {activeTab === 'approved' && (
        <div className="space-y-4">
          {approvedMembersFiltered.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 text-lg">No athletes in your squad yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Athletes will appear here after you approve their membership requests
              </p>
            </div>
          ) : (
            approvedMembersFiltered.map((membership) => (
              <div
                key={membership.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {membership.athlete?.Profile?.profilePhoto ? (
                      <img
                        src={getFullUrl(membership.athlete.Profile.profilePhoto)}
                        alt={membership.athlete.firstName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      `${membership.athlete?.firstName?.[0] || '?'}${membership.athlete?.lastName?.[0] || ''}`
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {membership.athlete?.firstName} {membership.athlete?.lastName}
                      {membership.athlete?.gender && (
                        <span className="ml-2 text-sm font-normal">
                          {membership.athlete.gender === 'male' ? '👨' : membership.athlete.gender === 'female' ? '👩' : ''}
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      {membership.teamType && (
                        <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full font-medium">
                          {teamTypes.find(t => t.id === membership.teamType)?.icon || '⚽'} {teamTypes.find(t => t.id === membership.teamType)?.label || membership.teamType}
                        </span>
                      )}
                      {membership.position && (
                        <span className="flex items-center gap-1">
                          ⚽ {membership.position}
                        </span>
                      )}
                      {membership.jerseyNumber && (
                        <span className="flex items-center gap-1">
                          👕 #{membership.jerseyNumber}
                        </span>
                      )}
                      {membership.joinedAt && (
                        <span className="flex items-center gap-1">
                          📅 Joined {new Date(membership.joinedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {membership.athlete?.Profile?.bio && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 line-clamp-2">
                        {membership.athlete.Profile.bio}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleRemove(membership.id)}
                    className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    title="Remove from club"
                  >
                    <TrashIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Staff Members */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {pendingStaff.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                <span className="text-lg">⏳</span>
                Kërkesa në pritje
              </div>
              {pendingStaff.map((staff) => (
                <div key={staff.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-yellow-400 dark:border-yellow-600">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                      {staff.staff?.Profile?.profilePhoto ? (
                        <img
                          src={getFullUrl(staff.staff.Profile.profilePhoto)}
                          alt={staff.staff.firstName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        `${staff.staff?.firstName?.[0] || '?'}${staff.staff?.lastName?.[0] || ''}`
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {staff.staff?.firstName} {staff.staff?.lastName}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {staffRoleLabels[staff.staffRole] || staff.staffRole || 'Staff'}
                      </div>
                      {staff.teamType && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Team: {teamTypes.find(t => t.id === staff.teamType)?.label || staff.teamType}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <select
                        value={pendingStaffRoles[staff.id] || staff.staffRole || 'assistant_coach'}
                        onChange={(e) => setPendingStaffRoles((prev) => ({ ...prev, [staff.id]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                      >
                        {staffRoleOptions.map((role) => (
                          <option key={role.id} value={role.id}>{role.label}</option>
                        ))}
                      </select>
                      <select
                        value={pendingStaffTeams[staff.id] || staff.teamType || 'first_team'}
                        onChange={(e) => setPendingStaffTeams((prev) => ({ ...prev, [staff.id]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                      >
                        {teamTypes.filter(t => t.id !== 'all').map((team) => (
                          <option key={team.id} value={team.id}>{team.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveStaff(staff.id)}
                          className="flex-1 p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectStaff(staff.id)}
                          className="flex-1 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {staffMembers.length === 0 && pendingStaff.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🧑‍🏫</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No staff members yet</h3>
              <p className="text-gray-600 dark:text-gray-400">Staff will appear here once added.</p>
            </div>
          ) : (
            staffMembers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
                  <span className="text-lg">✅</span>
                  Staff aktiv
                </div>
                {staffMembers.map((staff) => (
                  <div key={staff.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                        {staff.staff?.Profile?.profilePhoto ? (
                          <img
                            src={getFullUrl(staff.staff.Profile.profilePhoto)}
                            alt={staff.staff.firstName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          `${staff.staff?.firstName?.[0] || '?'}${staff.staff?.lastName?.[0] || ''}`
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {staff.staff?.firstName} {staff.staff?.lastName}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {staffRoleLabels[staff.staffRole] || staff.staffRole || 'Staff'}
                        </div>
                        {staff.teamType && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Team: {teamTypes.find(t => t.id === staff.teamType)?.label || staff.teamType}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Pending Requests */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-500 text-lg">No pending membership requests</p>
              <p className="text-gray-400 text-sm mt-2">
                Athletes who select your club will appear here for approval
              </p>
            </div>
          ) : (
            pendingRequests.map((membership) => (
              <div
                key={membership.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border-2 border-yellow-400 dark:border-yellow-600"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {membership.athlete?.Profile?.profilePhoto ? (
                      <img
                        src={getFullUrl(membership.athlete.Profile.profilePhoto)}
                        alt={membership.athlete.firstName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      `${membership.athlete?.firstName?.[0] || '?'}${membership.athlete?.lastName?.[0] || ''}`
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {membership.athlete?.firstName} {membership.athlete?.lastName}
                        {membership.athlete?.gender && (
                          <span className="ml-2 text-sm font-normal">
                            {membership.athlete.gender === 'male' ? '👨' : membership.athlete.gender === 'female' ? '👩' : ''}
                          </span>
                        )}
                      </h3>
                      <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs font-medium">
                        PENDING
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      {membership.athlete?.Profile?.age && membership.athlete?.Profile?.ageGroup && (
                        <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full">
                          🎂 {membership.athlete.Profile.age}y ({membership.athlete.Profile.ageGroup})
                        </span>
                      )}
                      {membership.position && (
                        <span className="flex items-center gap-1">
                          ⚽ {membership.position}
                        </span>
                      )}
                      {membership.jerseyNumber && (
                        <span className="flex items-center gap-1">
                          👕 Wants #{membership.jerseyNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        📅 Requested {new Date(membership.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {membership.athlete?.Profile?.bio && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 line-clamp-2">
                        {membership.athlete.Profile.bio}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(membership.id)}
                      className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                      title="Approve"
                    >
                      <CheckIcon className="h-6 w-6" />
                      <span className="hidden md:inline">Approve</span>
                    </button>
                    <button
                      onClick={() => handleReject(membership.id)}
                      className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
                      title="Reject"
                    >
                      <XMarkIcon className="h-6 w-6" />
                      <span className="hidden md:inline">Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Team Selection Modal */}
      {showTeamSelectModal && selectedMembership && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Assign Team
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select which team <strong>{selectedMembership.athlete?.firstName} {selectedMembership.athlete?.lastName}</strong> will join:
            </p>

            {/* Team Type Selection */}
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {teamTypes.filter(t => t.id !== 'all').map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamType(team.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition ${
                    selectedTeamType === team.id
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
                  }`}
                >
                  <span className="text-2xl">{team.icon}</span>
                  <span className={`font-medium ${
                    selectedTeamType === team.id 
                      ? 'text-green-700 dark:text-green-300' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {team.label}
                  </span>
                  {selectedTeamType === team.id && (
                    <CheckIcon className="h-6 w-6 text-green-600 ml-auto" />
                  )}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTeamSelectModal(false);
                  setSelectedMembership(null);
                  setSelectedTeamType('first_team');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                Approve & Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubRoster;
