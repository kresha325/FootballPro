
import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import ParticipantPickGrid from './ParticipantPickGrid';
import { Link } from 'react-router-dom';
import MediaSection from './media/MediaSection';

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

const isUpcomingMatch = (match) => {
  const timestamp = new Date(match.matchDate || match.scheduledAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

function EditMatchModal({ isOpen, onClose, match, tournaments, participants, stadiums, onSave }) {
  const [form, setForm] = useState({
    tournamentId: '',
    homeUserId: '',
    awayUserId: '',
    matchDate: '',
    round: 1,
    stadiumId: '',
  });

  useEffect(() => {
    if (isOpen && match) {
      setForm({
        tournamentId: match.tournamentId || '',
        homeUserId: match.homeUserId || '',
        awayUserId: match.awayUserId || '',
        matchDate: match.matchDate ? String(match.matchDate).slice(0, 16) : '',
        round: match.round || 1,
        stadiumId: match.stadiumId || match.Stadium?.id || '',
      });
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.homeUserId || !form.awayUserId) {
      alert('Zgjidh vendasin dhe mysafirin');
      return;
    }
    if (String(form.homeUserId) === String(form.awayUserId)) {
      alert('Vendas dhe mysafir nuk mund të jenë i njëjti');
      return;
    }
    if (!form.stadiumId) {
      alert('Zgjidh stadiumin');
      return;
    }
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vendas *</label>
              <p className="text-xs text-gray-500 mb-1">Zgjidh me avatar — emrat e njëjtë dallohen nga foto/ID</p>
              <ParticipantPickGrid
                options={participants}
                value={form.homeUserId}
                onSelect={(homeUserId) => setForm({ ...form, homeUserId })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mysafir *</label>
              <ParticipantPickGrid
                options={participants}
                value={form.awayUserId}
                onSelect={(awayUserId) => setForm({ ...form, awayUserId })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Stadiumi *</label>
            <select
              required
              value={form.stadiumId}
              onChange={(e) => setForm({ ...form, stadiumId: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            >
              <option value="">Zgjidh stadiumin</option>
              {(stadiums || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.city ? ` — ${s.city}` : ''}
                </option>
              ))}
            </select>
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
  const [loadError, setLoadError] = useState('');
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
    stadiumId: '',
  });
  const [stadiums, setStadiums] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [mediaMatchId, setMediaMatchId] = useState(null);
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
      setLoadError('');
    } catch (err) {
      console.error('Error fetching matches:', err);
      setLoadError('Ndeshjet nuk mund të ngarkoheshin. Kontrollo lidhjen dhe provo përsëri.');
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
        stadiumId: form.stadiumId,
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

  const liveMatches = useMemo(() => filterBySearch(
    matches.filter((m) => ['ongoing', 'live'].includes(String(m.status || '').toLowerCase())),
    listSearch,
    (m) => [m.homeUser?.firstName, m.homeUser?.lastName, m.awayUser?.firstName, m.awayUser?.lastName, m.Tournament?.name, m.Stadium?.name, m.status]
  ), [matches, listSearch]);
  const upcomingMatches = useMemo(() => {
    const base = matches.filter((m) => !['finished', 'ongoing', 'live'].includes(String(m.status || '').toLowerCase()) && isUpcomingMatch(m));
    return filterBySearch(base, listSearch, (m) => [
      m.homeUser?.firstName, m.homeUser?.lastName,
      m.awayUser?.firstName, m.awayUser?.lastName,
      m.location,
      m.status,
      m.Tournament?.name,
    ]);
  }, [matches, listSearch]);
  const completedMatches = useMemo(() => filterBySearch(
    matches.filter((m) => String(m.status || '').toLowerCase() === 'finished'),
    listSearch,
    (m) => [m.homeUser?.firstName, m.homeUser?.lastName, m.awayUser?.firstName, m.awayUser?.lastName, m.Tournament?.name, m.Stadium?.name]
  ), [matches, listSearch]);
  const visibleMatches = activeTab === 'live' ? liveMatches : activeTab === 'results' ? completedMatches : upcomingMatches;
  const teamName = (team) => [team?.firstName, team?.lastName].filter(Boolean).join(' ').trim() || '—';

  useEffect(() => {
    fetchMatches();
    fetchTournaments().then(setTournaments);
    api.get('/stadiums', { params: { limit: 200 } }).then((res) => {
      setStadiums(Array.isArray(res.data) ? res.data : []);
    }).catch(() => setStadiums([]));
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
    if (!formData.tournamentId || !formData.homeUserId || !formData.awayUserId || !formData.matchDate || !formData.stadiumId) {
      alert('Të gjitha fushat janë të detyrueshme (përfshirë stadiumin).');
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
        stadiumId: formData.stadiumId,
      });
      alert('Ndeshja u planifikua me sukses!');
      setShowCreateModal(false);
      setFormData({
        tournamentId: '',
        homeUserId: '',
        awayUserId: '',
        matchDate: getNowLocalDateTime(),
        round: 1,
        stadiumId: '',
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
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 px-4 py-5 pb-24 text-[var(--xt-color-text)] sm:px-6 sm:py-8">
      <header className="xt-card relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[var(--xt-color-gold)]/10 to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--xt-color-gold-bright)]">X TALENTI · Match Center</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Ndeshjet</h1><p className="mt-2 max-w-xl text-sm text-[var(--xt-color-text-muted)]">Kalendar, ndeshje live dhe rezultatet e turneve.</p></div>
          {canCreateMatch && <button onClick={() => setShowCreateModal(true)} className="btn btn-primary min-h-11 shrink-0">+ Krijo ndeshje</button>}
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchBar value={listSearch} onChange={setListSearch} placeholder="Kërko ndeshje, ekip, vend…" className="mb-0 flex-1" />
      </div>

      <nav className="xt-card grid grid-cols-3 gap-1 p-1" aria-label="Filtrim i ndeshjeve">
        {[['upcoming', 'Kalendar', upcomingMatches.length], ['live', 'Live', liveMatches.length], ['results', 'Rezultatet', completedMatches.length]].map(([id, label, count]) => <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)} className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${activeTab === id ? 'bg-[var(--xt-color-gold)] text-slate-950' : 'text-[var(--xt-color-text-muted)] hover:bg-white/5'}`}>{label}<span className="ml-2 tabular-nums opacity-75">{count}</span></button>)}
      </nav>

      <section className="space-y-3" aria-live="polite">
          {loading ? (
            <div className="xt-card space-y-3 p-5" aria-label="Po ngarkohen ndeshjet">{[0, 1, 2].map((key) => <div key={key} className="xt-skeleton h-24" />)}</div>
          ) : loadError ? (
            <div className="xt-error-state xt-card"><p>{loadError}</p><button type="button" className="btn btn-quiet min-h-10" onClick={() => { setLoading(true); fetchMatches(); }}>Provo përsëri</button></div>
          ) : visibleMatches.length === 0 ? (
            <div className="xt-empty-state xt-card">
              <CalendarIcon className="h-12 w-12 text-[var(--xt-color-gold)]" aria-hidden="true" />
              <p>{activeTab === 'live' ? 'Nuk ka ndeshje live tani.' : activeTab === 'results' ? 'Nuk ka rezultate të regjistruara.' : 'Nuk ka ndeshje të ardhshme të planifikuara.'}</p>
            </div>
          ) : (
            visibleMatches.map((match) => (
              <div
                key={match.id}
                className="xt-card overflow-hidden p-4 transition hover:border-[var(--xt-color-gold)]/40 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                    <div className="min-w-0 text-center sm:text-right">
                      <h2 className="break-words text-base font-bold text-white sm:text-xl">{teamName(match.homeUser)}</h2>
                      <span className="text-xs text-[var(--xt-color-text-subtle)]">Vendas</span>
                    </div>
                    <div className="min-w-16 text-center font-mono text-2xl font-black tabular-nums text-white sm:text-3xl" aria-label="Rezultati">
                      {match.scoreHome != null && match.scoreAway != null ? `${match.scoreHome} : ${match.scoreAway}` : <span className="text-base text-[var(--xt-color-gold-bright)]">VS</span>}
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <h2 className="break-words text-base font-bold text-white sm:text-xl">{teamName(match.awayUser)}</h2>
                      <span className="text-xs text-[var(--xt-color-text-subtle)]">Mysafir</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--xt-color-text-muted)] sm:justify-end">
                    {match.matchDate || match.scheduledAt ? <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" />{new Date(match.matchDate || match.scheduledAt).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}</span> : null}
                    {match.Stadium?.name || match.location ? <span className="inline-flex items-center gap-1.5"><MapPinIcon className="h-4 w-4" />{match.Stadium?.name || match.location}</span> : null}
                    {match.Tournament?.name && <span className="xt-badge xt-badge-gold">{match.Tournament.name}</span>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--xt-color-border)] pt-3">
                  <span className={`xt-badge ${activeTab === 'live' ? 'xt-badge-gold' : ''}`}>{activeTab === 'live' ? 'LIVE' : match.status || 'E planifikuar'}</span>
                  {match.round != null && <span className="text-xs text-[var(--xt-color-text-subtle)]">Raundi {match.round}</span>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-quiet min-h-10 px-3 text-sm"
                      onClick={() => setMediaMatchId((id) => (id === match.id ? null : match.id))}
                    >
                      {mediaMatchId === match.id ? 'Fshih median' : 'Media / YouTube'}
                    </button>
                    {activeTab === 'upcoming' && canEditThisMatch(match) && <button className="btn btn-quiet min-h-10 px-3 text-sm" onClick={() => handleEditMatch(match)}>Ndrysho ndeshjen</button>}
                    {match.tournamentId && <Link className="btn btn-quiet min-h-10 px-3 text-sm" to={`/tournaments?tournamentId=${match.tournamentId}`}>Qendra e ndeshjes</Link>}
                  </div>
                </div>
                {mediaMatchId === match.id ? (
                  <div className="mt-4 border-t border-[var(--xt-color-border)] pt-4">
                    <MediaSection
                      context="match"
                      entityId={match.id}
                      canManage={canEditThisMatch(match) || Number(user?.id) === Number(match.homeUserId) || Number(user?.id) === Number(match.awayUserId)}
                      title="Media e ndeshjes"
                      defaultCategory="match"
                      defaults={{
                        matchId: match.id,
                        tournamentId: match.tournamentId,
                        clubId: user?.role === 'club' ? user.id : undefined,
                        season: match.Tournament?.season,
                        category: 'match',
                      }}
                    />
                  </div>
                ) : null}
                {match.description && (
                  <p className="mt-3 text-sm text-[var(--xt-color-text-muted)]">
                    {match.description}
                  </p>
                )}
              </div>
            ))
          )}
      </section>

      <EditMatchModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditMatch(null); }}
        match={editMatch}
        tournaments={manageableTournaments}
        participants={editParticipants}
        stadiums={stadiums}
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lojtari vendas *</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Zgjidh me avatar — emrat e njëjtë dallohen nga foto/ID</p>
                  <ParticipantPickGrid
                    options={participants}
                    value={formData.homeUserId}
                    onSelect={(homeUserId) => setFormData({ ...formData, homeUserId })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lojtari mysafir *</label>
                  <ParticipantPickGrid
                    options={participants}
                    value={formData.awayUserId}
                    onSelect={(awayUserId) => setFormData({ ...formData, awayUserId })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stadiumi *</label>
                <select
                  required
                  value={formData.stadiumId}
                  onChange={(e) => setFormData({ ...formData, stadiumId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Zgjidh stadiumin</option>
                  {stadiums.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.city ? ` — ${s.city}` : ''}
                    </option>
                  ))}
                </select>
                {stadiums.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-600">Nuk ka stadiume në katalog. Admini duhet t’i shtojë te Stadiume.</p>
                ) : null}
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
    </main>
  );
}

export default Matches;
