import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { useAuth } from '../contexts/AuthContext';
import { clubMembersAPI, clubStaffAPI } from '../services/api';
import { CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

const VALID_ROSTER_TABS = new Set(['approved', 'pending', 'staff']);

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
    if (/(^|\/)default-avatar\.png$/i.test(normalized)) return '/default-avatar.svg';
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [pendingStaffRoles, setPendingStaffRoles] = useState({});
  const [pendingStaffTeams, setPendingStaffTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    VALID_ROSTER_TABS.has(tabFromUrl) ? tabFromUrl : 'approved'
  ); // approved, pending, staff
  const [teamFilter, setTeamFilter] = useState('all'); // all, first_team, women, men, youth teams
  const [listSearch, setListSearch] = useState('');
  const [showTeamSelectModal, setShowTeamSelectModal] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [selectedTeamType, setSelectedTeamType] = useState('first_team');
  const [selectedCompetitionCategory, setSelectedCompetitionCategory] = useState('open');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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

  const competitionCategories = [
    { id: 'open', label: 'Open' },
    { id: 'senior', label: 'Senior' },
    { id: 'u23', label: 'U23' },
    { id: 'u21', label: 'U21' },
    { id: 'u19', label: 'U19' },
    { id: 'u17', label: 'U17' },
    { id: 'u15', label: 'U15' },
    { id: 'u13', label: 'U13' },
    { id: 'u11', label: 'U11' },
    { id: 'u9', label: 'U9' },
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

  const normalizeGender = (value) => {
    const s = normalizeGroup(value);
    if (!s) return '';
    if (['m', 'male', 'mashkull', 'mask', 'man'].includes(s)) return 'male';
    if (['f', 'female', 'femër', 'femer', 'woman', 'girl'].includes(s)) return 'female';
    return s;
  };

  const memberAgeGroup = (membership) =>
    normalizeGroup(membership?.athlete?.Profile?.ageGroup || membership?.athlete?.ageGroup);

  const memberCompetitionCategory = (membership) =>
    normalizeGroup(membership?.competitionCategory);

  /** Club assignment wins over DOB ageGroup once liga/team is set. */
  const clubAssignedBand = (membership) => {
    const cat = memberCompetitionCategory(membership);
    const teamType = normalizeGroup(membership?.teamType);
    if (cat.startsWith('u') || cat === 'senior') return cat;
    if (teamType.startsWith('u')) return teamType;
    if (teamType === 'women' || teamType === 'men' || teamType === 'youth') return teamType;
    return '';
  };

  const isSeniorMember = (membership) => {
    const assigned = clubAssignedBand(membership);
    if (assigned) return assigned === 'senior';
    return memberAgeGroup(membership) === 'senior';
  };

  /** Badge label: youth must not show as First Team even if DB default is first_team. */
  const teamBadgeForMember = (membership) => {
    const teamType = membership?.teamType;
    const ageGroup = memberAgeGroup(membership);
    const assigned = clubAssignedBand(membership);

    if (teamType === 'first_team' && !isSeniorMember(membership)) {
      const youthId = assigned && assigned !== 'open' ? assigned : ageGroup;
      const fromCat = competitionCategories.find((c) => c.id === youthId);
      if (fromCat) return { id: fromCat.id, label: fromCat.label, icon: '🎯' };
      const fromTeam = teamTypes.find((t) => t.id === youthId);
      if (fromTeam) return fromTeam;
      return { id: youthId || 'youth', label: (youthId || 'Youth').toUpperCase(), icon: '🎯' };
    }

    const fromTeam = teamTypes.find((t) => t.id === teamType);
    if (fromTeam) return fromTeam;
    return { id: teamType, label: teamType || 'Team', icon: '⚽' };
  };

  const matchesTeamFilter = (membership) => {
    if (teamFilter === 'all') return true;

    const teamType = normalizeGroup(membership?.teamType);
    const gender = normalizeGender(membership?.athlete?.gender);
    const ageGroup = memberAgeGroup(membership);
    const assigned = clubAssignedBand(membership);

    if (teamFilter === 'first_team') {
      return isSeniorMember(membership);
    }

    if (teamFilter === 'men') {
      if (gender === 'male' || teamType === 'men') return true;
      if (gender === 'female' || teamType === 'women') return false;
      return teamType !== 'women';
    }

    if (teamFilter === 'women') {
      return gender === 'female' || teamType === 'women';
    }

    if (teamFilter === 'youth') {
      const band = assigned || ageGroup;
      return teamType === 'youth' || band.startsWith('u');
    }

    if (teamFilter.startsWith('u')) {
      // Prefer club-approved liga/team over birthdate age band.
      if (assigned.startsWith('u') || assigned === 'senior') {
        return assigned === teamFilter;
      }
      if (teamType.startsWith('u')) return teamType === teamFilter;
      return ageGroup === teamFilter;
    }

    return teamType === teamFilter;
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
    if (VALID_ROSTER_TABS.has(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'approved') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (user && user.role === 'club') {
      fetchRosterData();
    }
  }, [user]);

  const fetchRosterData = async () => {
    try {
      setLoading(true);
      // Always load approved + pending (+ staff) so tab badges stay correct without clicking.
      const [approvedRes, pendingRes, staffActiveRes, staffPendingRes] = await Promise.all([
        clubMembersAPI.getClubMembers(user.id, 'approved'),
        clubMembersAPI.getClubMembers(user.id, 'pending'),
        clubStaffAPI.getClubStaff(user.id, { status: 'active' }),
        clubStaffAPI.getClubStaff(user.id, { status: 'pending' }),
      ]);

      setMembers(approvedRes.data || []);
      setPendingRequests(pendingRes.data || []);
      setStaffMembers(staffActiveRes.data || []);
      setPendingStaff(staffPendingRes.data || []);

      const roleMap = {};
      const teamMap = {};
      (staffPendingRes.data || []).forEach((staff) => {
        roleMap[staff.id] = staff.staffRole || 'assistant_coach';
        teamMap[staff.id] = staff.teamType || 'first_team';
      });
      setPendingStaffRoles(roleMap);
      setPendingStaffTeams(teamMap);
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
      const isYouthCategory = selectedCompetitionCategory?.startsWith?.('u');
      const isSeniorCategory =
        selectedCompetitionCategory === 'senior' || selectedCompetitionCategory === 'open';
      // First Team is seniors only; youth assignments use age/category teamType.
      let teamTypeToSave = selectedTeamType;
      if (selectedTeamType === 'first_team' && isYouthCategory) {
        teamTypeToSave = selectedCompetitionCategory;
      } else if (
        selectedTeamType === 'first_team' &&
        !isSeniorCategory &&
        selectedCompetitionCategory !== 'open'
      ) {
        teamTypeToSave = selectedCompetitionCategory || 'youth';
      }

      await clubMembersAPI.updateMembershipStatus(selectedMembership.id, 'approved');
      await clubMembersAPI.updateMember(selectedMembership.id, {
        teamType: teamTypeToSave,
        competitionCategory:
          selectedTeamType === 'first_team' && !isYouthCategory
            ? selectedCompetitionCategory === 'open'
              ? 'senior'
              : selectedCompetitionCategory
            : selectedCompetitionCategory,
      });
      
      setShowTeamSelectModal(false);
      setSelectedMembership(null);
      setSelectedTeamType('first_team');
      setSelectedCompetitionCategory('open');
      fetchRosterData();
      alert('Athlete approved successfully!');
    } catch (error) {
      console.error('Error approving member:', error);
      alert('Failed to approve athlete');
    }
  };

  const openCategoryModal = (membership) => {
    setSelectedMembership(membership);
    const ageGroup = memberAgeGroup(membership);
    const fallback =
      membership.competitionCategory ||
      (isSeniorMember(membership) ? 'senior' : ageGroup && ageGroup !== 'n/a' ? ageGroup : null) ||
      (membership.teamType === 'first_team' && isSeniorMember(membership)
        ? 'senior'
        : membership.teamType) ||
      'open';
    setSelectedCompetitionCategory(fallback);
    setShowCategoryModal(true);
  };

  const confirmCategoryChange = async () => {
    try {
      const cat = String(selectedCompetitionCategory || '').trim().toLowerCase();
      const patch = { competitionCategory: selectedCompetitionCategory };
      // Keep teamType aligned: First Team only for seniors; youth liga → youth age team.
      if (cat.startsWith('u')) {
        patch.teamType = cat;
      } else if (cat === 'senior') {
        patch.teamType = 'first_team';
      }
      await clubMembersAPI.updateMember(selectedMembership.id, patch);
      setShowCategoryModal(false);
      setSelectedMembership(null);
      fetchRosterData();
    } catch (error) {
      console.error('Error updating competition category:', error);
      alert('Nuk u përditësua kategoria e ligës');
    }
  };

  const handleReject = async (membershipId) => {
    try {
      await clubMembersAPI.updateMembershipStatus(membershipId, 'rejected');
      fetchRosterData();
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
      fetchRosterData();
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
      fetchRosterData();
      alert('Staff approved successfully!');
    } catch (error) {
      console.error('Error approving staff:', error);
      alert('Failed to approve staff');
    }
  };

  const handleRejectStaff = async (staffId) => {
    try {
      await clubStaffAPI.updateStaff(staffId, { status: 'inactive' });
      fetchRosterData();
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-5 sm:p-8 text-white mb-6">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2">Club Roster Management</h1>
        <p className="text-white/90 text-sm sm:text-base">Manage your club's athletes and membership requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => selectTab('approved')}
          className={`shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm ${
            activeTab === 'approved'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          👥 Squad ({members.length})
        </button>
        <button
          onClick={() => selectTab('pending')}
          className={`shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition relative text-sm ${
            activeTab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          ⏳ Pending ({pendingRequests.length})
          {pendingRequests.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => selectTab('staff')}
          className={`shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm ${
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
            approvedMembersFiltered.map((membership) => {
              const teamBadge = teamBadgeForMember(membership);
              return (
              <div
                key={membership.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white break-words">
                      {membership.athlete?.firstName} {membership.athlete?.lastName}
                      {membership.athlete?.gender && (
                        <span className="ml-2 text-sm font-normal">
                          {normalizeGender(membership.athlete.gender) === 'male' ? '👨' : normalizeGender(membership.athlete.gender) === 'female' ? '👩' : ''}
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      {membership.teamType && (
                        <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full font-medium">
                          {teamBadge.icon} {teamBadge.label}
                        </span>
                      )}
                      <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                        Ligë:{' '}
                        {competitionCategories.find(
                          (c) => c.id === (membership.competitionCategory || 'open')
                        )?.label || membership.competitionCategory || 'Open'}
                      </span>
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
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => openCategoryModal(membership)}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition"
                      title="Ndrysho kategorinë e ligës për këtë edicion"
                    >
                      Kategoria ligë
                    </button>
                    <button
                      onClick={() => handleRemove(membership.id)}
                      className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition self-start sm:self-auto"
                      title="Remove from club"
                    >
                      <TrashIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })
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
                    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[180px]">
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
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {teamTypes.filter(t => t.id !== 'all').map((team) => (
                <button
                  key={team.id}
                  type="button"
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

            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
              Kategoria e ligës për këtë edicion (p.sh. U10 mund të luajë U11)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {competitionCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCompetitionCategory(cat.id)}
                  className={`px-2 py-2.5 min-h-10 rounded-lg border text-sm font-medium transition ${
                    selectedCompetitionCategory === cat.id
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowTeamSelectModal(false);
                  setSelectedMembership(null);
                  setSelectedTeamType('first_team');
                  setSelectedCompetitionCategory('open');
                }}
                className="flex-1 min-h-11 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                className="flex-1 min-h-11 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                Approve & Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && selectedMembership && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Kategoria e ligës
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Vendos në cilën kategori do të luajë{' '}
              <strong>
                {selectedMembership.athlete?.firstName} {selectedMembership.athlete?.lastName}
              </strong>{' '}
              për këtë edicion (pjesëmarrës në turneun e ligës për gola/asiste).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {competitionCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCompetitionCategory(cat.id)}
                  className={`px-2 py-2.5 min-h-10 rounded-lg border text-sm font-medium transition ${
                    selectedCompetitionCategory === cat.id
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedMembership(null);
                }}
                className="flex-1 min-h-11 px-4 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium"
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={confirmCategoryChange}
                className="flex-1 min-h-11 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Ruaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubRoster;
