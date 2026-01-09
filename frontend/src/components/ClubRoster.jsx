import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { clubMembersAPI } from '../services/api';
import { CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

function ClubRoster() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approved'); // approved, pending
  const [teamFilter, setTeamFilter] = useState('all'); // all, first_team, women, men, youth teams
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

  useEffect(() => {
    if (user && user.role === 'club') {
      fetchMembers();
    }
  }, [user, activeTab]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
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

      {/* Approved Members */}
      {activeTab === 'approved' && (
        <div className="space-y-4">
          {members.filter(m => teamFilter === 'all' || m.teamType === teamFilter).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 text-lg">No athletes in your squad yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Athletes will appear here after you approve their membership requests
              </p>
            </div>
          ) : (
            members.filter(m => teamFilter === 'all' || m.teamType === teamFilter).map((membership) => (
              <div
                key={membership.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {membership.athlete?.Profile?.profilePhoto ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL.replace('/api','')}${membership.athlete.Profile.profilePhoto}`}
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
                        src={`https://192.168.100.57:5098${membership.athlete.Profile.profilePhoto}`}
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
