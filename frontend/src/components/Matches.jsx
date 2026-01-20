
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { CalendarIcon, MapPinIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

// Helper: fetch tournaments and participants
const fetchTournaments = async () => {
  const res = await api.get('/tournaments');
  return res.data || [];
};
const fetchParticipants = async (tournamentId) => {
  if (!tournamentId) return [];
  const res = await api.get(`/tournaments/${tournamentId}`);
  return res.data?.participants || [];
};

function EditMatchModal({ isOpen, onClose, match, tournaments, participants, onSave }) {
  const [form, setForm] = useState({
    tournamentId: match?.tournamentId || '',
    homeUserId: match?.homeUserId || '',
    awayUserId: match?.awayUserId || '',
    matchDate: match?.matchDate ? match.matchDate.slice(0, 16) : '',
    round: match?.round || 1,
  });
  const [error, setError] = useState('');
  useEffect(() => {
    if (isOpen && match) {
      setForm({
        tournamentId: match.tournamentId,
        homeUserId: match.homeUserId,
        awayUserId: match.awayUserId,
        matchDate: match.matchDate ? match.matchDate.slice(0, 16) : '',
        round: match.round || 1,
      });
    }
  }, [isOpen, match]);
}

function Matches() {
    // Open edit modal for a match
    const handleEditMatch = (match) => {
      setEditMatch(match);
      setEditModalOpen(true);
    };
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [participants, setParticipants] = useState([]);
  // Helper to get current date/time in 'YYYY-MM-DDTHH:mm' format for datetime-local
  function getNowLocalDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  const [formData, setFormData] = useState({
    tournamentId: '',
    homeUserId: '',
    awayUserId: '',
    matchDate: getNowLocalDateTime(),
    round: 1,
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMatch, setEditMatch] = useState(null);

  // Filter matches for upcoming (scheduled in the future)
  const now = new Date();
  const upcomingMatches = matches.filter(m => new Date(m.scheduledAt || m.matchDate) > now);

  useEffect(() => {
    fetchMatches();
    fetchTournaments().then(setTournaments);
  }, []);

  useEffect(() => {
    if (formData.tournamentId) {
      fetchParticipants(formData.tournamentId).then(setParticipants);
    } else {
      setParticipants([]);
    }
  }, [formData.tournamentId]);

  const fetchMatches = async () => {
    try {
      const response = await api.get('/matches');
      setMatches(response.data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!formData.tournamentId || !formData.homeUserId || !formData.awayUserId || !formData.matchDate) {
      alert('Të gjitha fushat janë të detyrueshme.');
      return;
    }
    if (formData.homeUserId === formData.awayUserId) {
      alert('Nuk mund të zgjedhësh të njëjtin lojtar për të dy ekipet.');
      return;
    }
    // Check if date is in the past
    const selectedDate = new Date(formData.matchDate);
    const now = new Date();
    if (selectedDate < now) {
      alert('Data e zgjedhur ka kaluar. Ju lutem vendosni statistikat e ndeshjes në seksionin përkatës.');
      setShowCreateModal(false);
      return;
    }
    try {
      await api.post('/matches', {
        tournamentId: formData.tournamentId,
        homeUserId: formData.homeUserId,
        awayUserId: formData.awayUserId,
        matchDate: formData.matchDate,
        round: formData.round,
      });
      alert('Match scheduled successfully!');
      setShowCreateModal(false);
      setFormData({
        tournamentId: '',
        homeUserId: '',
        awayUserId: '',
        matchDate: getNowLocalDateTime(),
        round: 1,
      });
      fetchMatches();
    } catch (error) {
      console.error('Error creating match:', error);
      alert('Failed to schedule match');
    }
  };

  // ...existing code...

  // JSX rendering
  return (
    <div>
      {/* Create Match Button (visible for all, or add role check if needed) */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow"
        >
          Krijo Ndeshje
        </button>
      </div>

      {/* Upcoming Matches List */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {upcomingMatches.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No upcoming matches scheduled</p>
            </div>
          ) : (
            upcomingMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Teams */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 text-right">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {match.homeTeam}
                      </h3>
                      <span className="text-sm text-gray-500">Home</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-400">VS</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {match.awayTeam}
                      </h3>
                      <span className="text-sm text-gray-500">Away</span>
                    </div>
                  </div>
                  {/* Match Info */}
                  <div className="flex flex-col gap-2 md:w-64">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="h-5 w-5" />
                      <span className="text-sm">
                        {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <ClockIcon className="h-5 w-5" />
                      <span className="text-sm">
                        {new Date(match.scheduledAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {match.location && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPinIcon className="h-5 w-5" />
                        <span className="text-sm">{match.location}</span>
                      </div>
                    )}
                  </div>
                  {/* Status Badge */}
                  <div>
                    <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium">
                      {match.status || 'Scheduled'}
                    </span>
                  </div>
                  <button className="ml-4 px-3 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500" onClick={() => handleEditMatch(match)}>
                    Edit
                  </button>
                </div>
                {match.description && (
                  <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm">
                    {match.description}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Match Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Krijo Ndeshje
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Turneu *</label>
                <select
                  required
                  value={formData.tournamentId}
                  onChange={e => setFormData({ ...formData, tournamentId: e.target.value, homeUserId: '', awayUserId: '' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Zgjidh turneun</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lojtari vendas *</label>
                  <select
                    required
                    value={formData.homeUserId}
                    onChange={e => setFormData({ ...formData, homeUserId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Zgjidh lojtarin vendas</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lojtari mysafir *</label>
                  <select
                    required
                    value={formData.awayUserId}
                    onChange={e => setFormData({ ...formData, awayUserId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Zgjidh lojtarin mysafir</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data & Ora *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.matchDate}
                    onChange={e => setFormData({ ...formData, matchDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Raundi</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.round}
                    onChange={e => setFormData({ ...formData, round: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Anulo
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Krijo Ndeshje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Matches;
