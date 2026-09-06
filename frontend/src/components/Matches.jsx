
import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
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
    tournamentId: '',
    homeUserId: '',
    awayUserId: '',
    matchDate: '',
    round: 1,
  });

  useEffect(() => {
    if (isOpen && match) {
      setForm({
        tournamentId: match.tournamentId || '',
        homeUserId: match.homeUserId || '',
        awayUserId: match.awayUserId || '',
        matchDate: match.matchDate ? String(match.matchDate).slice(0, 16) : '',
        round: match.round || 1,
      });
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(match.id, form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg max-w-2xl w-full p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Ndrysho ndeshjen</h2>
          <button type="button" onClick={onClose} className="shrink-0 text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Turneu *</label>
            <select
              required
              value={form.tournamentId}
              onChange={(e) => setForm({ ...form, tournamentId: e.target.value })}
              className="w-full min-w-0 max-w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            >
              <option value="">Zgjidh turneun</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Vendas *</label>
              <select
                required
                value={form.homeUserId}
                onChange={(e) => setForm({ ...form, homeUserId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="">Zgjidh</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mysafir *</label>
              <select
                required
                value={form.awayUserId}
                onChange={(e) => setForm({ ...form, awayUserId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="">Zgjidh</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Data & Ora *</label>
              <input
                type="datetime-local"
                required
                value={form.matchDate}
                onChange={(e) => setForm({ ...form, matchDate: e.target.value })}
                className="w-full min-w-0 max-w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Raundi</label>
              <input
                type="number"
                min={1}
                value={form.round}
                onChange={(e) => setForm({ ...form, round: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-200 rounded-lg">Anulo</button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg">Ruaj</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeTab = 'upcoming';
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
  const [editParticipants, setEditParticipants] = useState([]);
  const [listSearch, setListSearch] = useState('');

  const manageableTournaments = useMemo(() => {
    if (!user?.id) return [];
    return (tournaments || []).filter((t) => {
      if (Number(t.creatorId) !== Number(user.id) && user.role !== 'admin') return false;
      if ((t.ligaId || t.sourceRole === 'liga') && user.role !== 'liga' && user.role !== 'admin') {
        return false;
      }
      return true;
    });
  }, [tournaments, user]);

  const canCreateMatch = manageableTournaments.length > 0;

  const canEditThisMatch = (match) => {
    if (!user?.id || !match) return false;
    if (user.role === 'admin') return true;
    const t =
      tournaments.find((x) => Number(x.id) === Number(match.tournamentId)) ||
      match.Tournament;
    if (!t) return Number(match.creatorId) === Number(user.id);
    if (Number(t.creatorId) !== Number(user.id)) return false;
    if ((t.ligaId || t.sourceRole === 'liga') && user.role !== 'liga') return false;
    return true;
  };

  const handleEditMatch = async (match) => {
    setEditMatch(match);
    setEditModalOpen(true);
    if (match.tournamentId) {
      const parts = await fetchParticipants(match.tournamentId);
      setEditParticipants(parts);
    } else {
      setEditParticipants([]);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await api.get('/matches');
      setMatches(response.data || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditMatch = async (matchId, form) => {
    try {
      await api.put(`/matches/${matchId}`, {
        tournamentId: form.tournamentId,
        homeUserId: form.homeUserId,
        awayUserId: form.awayUserId,
        matchDate: form.matchDate,
        round: form.round,
      });
      setEditModalOpen(false);
      setEditMatch(null);
      fetchMatches();
      alert('Ndeshja u përditësua.');
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Dështoi përditësimi i ndeshjes.');
    }
  };

  const now = new Date();
  const upcomingMatches = useMemo(() => {
    const base = matches.filter((m) => new Date(m.scheduledAt || m.matchDate) > now);
    return filterBySearch(base, listSearch, (m) => [
      m.homeTeam,
      m.awayTeam,
      m.location,
      m.status,
      m.Tournament?.name,
    ]);
  }, [matches, listSearch]);

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
      alert('Ndeshja u planifikua me sukses!');
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
      alert(error.response?.data?.msg || 'Nuk u arrit planifikimi i ndeshjes');
    }
  };

  // ...existing code...

  // JSX rendering
  return (
    <div>
      {/* Create Match Button (visible for all, or add role check if needed) */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <ListSearchBar value={listSearch} onChange={setListSearch} placeholder="Kërko ndeshje, ekip, vend…" className="mb-0 flex-1" />
        {canCreateMatch && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow shrink-0"
          >
            Krijo Ndeshje
          </button>
        )}
      </div>

      {/* Upcoming Matches List */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center text-gray-500">
              Duke ngarkuar ndeshjet…
            </div>
          ) : upcomingMatches.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nuk ka ndeshje të ardhshme të planifikuara</p>
            </div>
          ) : (
            upcomingMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Teams */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div className="flex-1 text-center sm:text-right min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white break-words">
                        {match.homeTeam}
                      </h3>
                      <span className="text-sm text-gray-500">Vendas</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-400 text-center shrink-0">VS</div>
                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white break-words">
                        {match.awayTeam}
                      </h3>
                      <span className="text-sm text-gray-500">Mysafir</span>
                    </div>
                  </div>
                  {/* Match Info */}
                  <div className="flex flex-col gap-2 w-full md:w-64">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="h-5 w-5 shrink-0" />
                      <span className="text-sm">
                        {new Date(match.scheduledAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <ClockIcon className="h-5 w-5 shrink-0" />
                      <span className="text-sm">
                        {new Date(match.scheduledAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {match.location && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPinIcon className="h-5 w-5 shrink-0" />
                        <span className="text-sm break-words">{match.location}</span>
                      </div>
                    )}
                  </div>
                  {/* Status Badge */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium">
                      {match.status || 'E planifikuar'}
                    </span>
                    {canEditThisMatch(match) && (
                      <button className="px-3 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500 text-sm font-medium" onClick={() => handleEditMatch(match)}>
                        Ndrysho
                      </button>
                    )}
                  </div>
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

      <EditMatchModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditMatch(null); }}
        match={editMatch}
        tournaments={manageableTournaments}
        participants={editParticipants}
        onSave={handleSaveEditMatch}
      />

      {/* Create Match Modal */}
      {showCreateModal && canCreateMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg max-w-2xl w-full p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Krijo Ndeshje
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
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
                  {manageableTournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Në turne të ligës vetëm liga krijon ndeshje; në të tjerat vetëm krijuesi i turneut.
                </p>
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
                    className="w-full min-w-0 max-w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
