import { useState, useEffect, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserAvatarLink from './UserAvatarLink';
import { resolveParticipantUserId } from '../utils/tournamentParticipants';
import { APP_BRAND_NAME } from '../config/branding';
import {
  formatTournamentTitle,
  previewTournamentSeason,
  seasonLabel,
  todayDateInputValue,
} from '../utils/footballSeason';
import axios from 'axios';
import MatchGoalEventsForm, { eventsFromMatchData } from './MatchGoalEventsForm';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function participantLabel(p, participantType) {
  const club = p.Profile?.club;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  const role = p.role;
  const uid = resolveParticipantUserId(p);
  const fallback = uid ? `#${uid}` : '';
  if (participantType === 'club') {
    return name || club || (fallback ? `Klubi ${fallback}` : 'Klubi');
  }
  if (participantType === 'mixed') {
    if (role === 'club') return name || club || (fallback ? `Klubi ${fallback}` : 'Klubi');
    if (role === 'athlete') {
      if (club && name) return `${name} (${club})`;
      return name || (fallback ? `Atleti ${fallback}` : 'Atlet');
    }
    return name || (fallback ? `Përdorues ${fallback}` : 'Përdorues');
  }
  if (club && name) return `${name} (${club})`;
  return name || club || (fallback ? `Përdorues ${fallback}` : 'Përdorues');
}

function avatarUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  return `${base}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

function scorerLine(row) {
  const name = [row.User?.firstName, row.User?.lastName].filter(Boolean).join(' ') || `Lojtari #${row.userId}`;
  const assistName = row.assistUser
    ? [row.assistUser.firstName, row.assistUser.lastName].filter(Boolean).join(' ')
    : null;
  const minute = row.minute != null ? `${row.minute}'` : null;
  if (minute && assistName) return `${name} ${minute} (asist: ${assistName})`;
  if (minute) return `${name} ${minute}`;
  if (assistName) return `${name} (asist: ${assistName})`;
  return name;
}

function MatchBroadcastModal({
  open,
  loading,
  error,
  data,
  participantType,
  onClose,
  canEdit = false,
  participants = [],
  onSaveMatch,
  saving = false,
}) {
  const [scoreHomeInput, setScoreHomeInput] = useState('');
  const [scoreAwayInput, setScoreAwayInput] = useState('');
  const [goalEvents, setGoalEvents] = useState([]);

  const m = data?.match;

  useEffect(() => {
    if (!m) return;
    setScoreHomeInput(m.scoreHome != null ? String(m.scoreHome) : '');
    setScoreAwayInput(m.scoreAway != null ? String(m.scoreAway) : '');
    setGoalEvents(eventsFromMatchData(data));
  }, [m?.id, data]);

  if (!open) return null;
  const home = m?.homeUser;
  const away = m?.awayUser;
  const scH = data?.scorersBySide?.home || [];
  const scA = data?.scorersBySide?.away || [];
  const tName = m?.Tournament?.name || 'Turneu';
  const sh = m?.scoreHome;
  const sa = m?.scoreAway;
  const hasScore = sh != null && sa != null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative overflow-hidden border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent" />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Ndeshje zyrtare</p>
              <p className="text-sm text-slate-300">{tName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {m?.matchDate ? new Date(m.matchDate).toLocaleString() : '—'} · Raundi {m?.round ?? '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Mbyll
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-red-300 text-sm">{error}</div>
        )}

        {!loading && !error && m && (
          <>
            <div className="px-4 py-6 sm:px-8">
              <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col items-center gap-2 text-center sm:items-end sm:text-right">
                  <div className="flex items-center gap-3">
                    {avatarUrl(home?.Profile?.profilePhoto) ? (
                      <img src={avatarUrl(home.Profile.profilePhoto)} alt="" className="h-14 w-14 rounded-full border-2 border-white/20 object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-emerald-300">
                        {(home?.firstName?.[0] || '?').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-bold leading-tight sm:text-xl">{participantLabel(home, participantType)}</p>
                      {home?.Profile?.position && <p className="text-xs text-slate-400">{home.Profile.position}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-center justify-center px-4">
                  <span
                    className={`mb-2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      m.status === 'finished'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : m.status === 'ongoing'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-slate-600 text-slate-300'
                    }`}
                  >
                    {m.status === 'finished' ? 'Përfunduar' : m.status === 'ongoing' ? 'Live' : 'Në program'}
                  </span>
                  <div className="flex items-baseline gap-2 font-mono text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
                    <span className="text-white">{hasScore ? sh : '—'}</span>
                    <span className="text-slate-500">:</span>
                    <span className="text-white">{hasScore ? sa : '—'}</span>
                  </div>
                  {m.minutesPlayed && <p className="mt-1 text-xs text-slate-400">Minuta: {m.minutesPlayed}</p>}
                </div>

                <div className="flex flex-1 flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-start sm:gap-4 sm:text-left">
                  {avatarUrl(away?.Profile?.profilePhoto) ? (
                    <img src={avatarUrl(away.Profile.profilePhoto)} alt="" className="h-14 w-14 shrink-0 rounded-full border-2 border-white/20 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-cyan-300">
                      {(away?.firstName?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold leading-tight sm:text-xl">{participantLabel(away, participantType)}</p>
                    {away?.Profile?.position && <p className="text-xs text-slate-400">{away.Profile.position}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-0 border-t border-white/10 sm:grid-cols-2">
              <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-r sm:p-5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-400/90">Golashënues — vendas</h4>
                {scH.length === 0 ? (
                  <p className="text-sm text-slate-500">Nuk ka të dhëna të detajuara.</p>
                ) : (
                  <ul className="space-y-2">
                    {scH.map((row) => (
                      <li key={row.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <span className="font-medium text-slate-100">{scorerLine(row)}</span>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-emerald-300">{row.goals ?? 1}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-4 sm:p-5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-400/90">Golashënues — mysafir</h4>
                {scA.length === 0 ? (
                  <p className="text-sm text-slate-500">Nuk ka të dhëna të detajuara.</p>
                ) : (
                  <ul className="space-y-2">
                    {scA.map((row) => (
                      <li key={row.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <span className="font-medium text-slate-100">{scorerLine(row)}</span>
                        <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-cyan-200">{row.goals ?? 1}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 px-4 py-4 sm:px-6">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Përmbledhje & statistikë</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Gola (tabela)</p>
                  <p className="text-lg font-bold tabular-nums">
                    {sh ?? '—'} – {sa ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Gola (golashënues)</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-200">
                    {data?.scorerTotals?.home ?? 0} – {data?.scorerTotals?.away ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Asiste (detaj)</p>
                  <p className="text-lg font-bold tabular-nums">
                    {[...(scH || []), ...(scA || [])].filter((row) => row.assistUserId).length}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Status</p>
                  <p className="text-lg font-bold tabular-nums capitalize">{m.status || '—'}</p>
                </div>
              </div>
              {hasScore && (data?.scorerTotals?.home !== sh || data?.scorerTotals?.away !== sa) && (
                <p className="mt-3 text-xs text-amber-200/90">
                  Shënim: rezultati në tabelë mund të mos përputhet me shumën e golashënuesve derisa të përditësohen të dhënat.
                </p>
              )}
            </div>

            {canEdit ? (
              <div className="border-t border-white/10 bg-slate-950/80 px-4 py-5 sm:px-6">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-300">Raporto rezultatin</h4>
                <div className="mb-4 flex items-center justify-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={scoreHomeInput}
                    onChange={(e) => setScoreHomeInput(e.target.value)}
                    className="w-20 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center text-xl font-bold text-white"
                    placeholder="0"
                  />
                  <span className="text-2xl font-bold text-slate-400">:</span>
                  <input
                    type="number"
                    min="0"
                    value={scoreAwayInput}
                    onChange={(e) => setScoreAwayInput(e.target.value)}
                    className="w-20 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center text-xl font-bold text-white"
                    placeholder="0"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 ring-1 ring-emerald-500/20">
                  <MatchGoalEventsForm
                    participants={participants}
                    homeUserId={m.homeUserId}
                    awayUserId={m.awayUserId}
                    initialEvents={goalEvents}
                    onChange={setGoalEvents}
                    variant="dark"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    onSaveMatch?.({
                      scoreHome: Number(scoreHomeInput),
                      scoreAway: Number(scoreAwayInput),
                      status: 'finished',
                      goalEvents: goalEvents
                        .filter((ev) => ev.userId)
                        .map((ev) => ({
                          userId: Number(ev.userId),
                          minute: ev.minute === '' ? null : Number(ev.minute),
                          assistUserId: ev.assistUserId ? Number(ev.assistUserId) : null,
                          side: ev.side || undefined,
                        })),
                    })
                  }
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {saving ? 'Duke ruajtur…' : 'Ruaj rezultatin & golat'}
                </button>
              </div>
            ) : (
              <p className="border-t border-white/10 px-4 py-4 text-center text-sm text-slate-400 sm:px-6">
                Vetëm krijuesi i ndeshjes mund të vendosë dhe ruajë statistikat.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TournamentSimple() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [listSearch, setListSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTournament, setEditTournament] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    type: 'knockout',
    maxParticipants: 8,
    category: 'open',
    status: 'open',
  });
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExtras, setDetailExtras] = useState({
    standings: null,
    matches: [],
    stats: null,
  });
  const [matchModal, setMatchModal] = useState({ open: false, loading: false, error: null, data: null });
  const [savingMatch, setSavingMatch] = useState(false);
  /** Seksioni aktiv në modalin e turneut: përmbledhje | tabelë sipas pikëve | ndeshjet | skuadra */
  const [detailTab, setDetailTab] = useState('overview');

  const openTournamentModal = (tournament, tab = 'overview') => {
    setDetailTab(tab);
    setSelectedTournament(tournament);
  };
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    type: 'knockout',
    startDate: todayDateInputValue(),
    maxParticipants: 8,
    participantType: 'individual',
    category: 'open',
  });

  const canCreateTournament = ['liga', 'club', 'scout'].includes(user?.role);
  const isLigaCreator = user?.role === 'liga';

  const createSeasonPreview = previewTournamentSeason(newTournament.type, newTournament.startDate);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await API.get('/tournaments');
      const list = response.data || [];
      setTournaments(list);
      const deepLinkId = searchParams.get('tournamentId');
      if (deepLinkId) {
        const found = list.find((t) => String(t.id) === String(deepLinkId));
        if (found) {
          setSelectedTournament(found);
          setDetailTab('table');
        } else {
          try {
            const tRes = await API.get(`/tournaments/${deepLinkId}`);
            if (tRes.data) setSelectedTournament(tRes.data);
          } catch (_e) {
            /* ignore */
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = selectedTournament?.id;
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const [tRes, stRes, mRes, statRes] = await Promise.all([
          API.get(`/tournaments/${id}`),
          API.get(`/tournaments/${id}/standings`).catch(() => ({ data: null })),
          API.get(`/tournaments/${id}/matches`).catch(() => ({ data: [] })),
          API.get(`/tournaments/${id}/stats`).catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setSelectedTournament(tRes.data);
        setDetailExtras({
          standings: stRes.data,
          matches: Array.isArray(mRes.data) ? mRes.data : [],
          stats: statRes.data,
        });
      } catch (error) {
        if (!cancelled) console.error('Tournament detail:', error);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTournament?.id]);

  const closeMatchModal = () => setMatchModal({ open: false, loading: false, error: null, data: null });

  const refreshTournamentDetail = async () => {
    const id = selectedTournament?.id;
    if (!id) return;
    const [tRes, stRes, mRes, statRes] = await Promise.all([
      API.get(`/tournaments/${id}`),
      API.get(`/tournaments/${id}/standings`).catch(() => ({ data: null })),
      API.get(`/tournaments/${id}/matches`).catch(() => ({ data: [] })),
      API.get(`/tournaments/${id}/stats`).catch(() => ({ data: null })),
    ]);
    setSelectedTournament(tRes.data);
    setDetailExtras({
      standings: stRes.data,
      matches: Array.isArray(mRes.data) ? mRes.data : [],
      stats: statRes.data,
    });
  };

  const canEditMatch = (match) => {
    if (!user?.id) return false;
    if (user.role === 'admin') return true;
    const t = selectedTournament || match?.Tournament;
    const creatorId = t?.creatorId ?? t?.creator?.id ?? match?.Tournament?.creatorId;
    if (creatorId == null) return false;
    return Number(creatorId) === Number(user.id);
  };

  const saveMatchReport = async (payload) => {
    const matchId = matchModal.data?.match?.id;
    if (!matchId) return;
    setSavingMatch(true);
    try {
      await API.put(`/tournaments/matches/${matchId}/score`, payload);
      const tid = selectedTournament?.id;
      const res = await API.get(`/tournaments/${tid}/matches/${matchId}`);
      setMatchModal((prev) => ({ ...prev, data: res.data }));
      await refreshTournamentDetail();
      alert('Rezultati dhe golat u ruajtën.');
    } catch (e) {
      alert(e.response?.data?.msg || 'Nuk u ruajt dot rezultati.');
    } finally {
      setSavingMatch(false);
    }
  };

  const openMatchDetail = async (matchId) => {
    const tid = selectedTournament?.id;
    if (!tid) return;
    setMatchModal({ open: true, loading: true, error: null, data: null });
    try {
      const res = await API.get(`/tournaments/${tid}/matches/${matchId}`);
      setMatchModal({ open: true, loading: false, error: null, data: res.data });
    } catch (e) {
      setMatchModal({
        open: true,
        loading: false,
        error: e.response?.data?.msg || 'Nuk u ngarkuan të dhënat e ndeshjes',
        data: null,
      });
    }
  };

  const createTournament = async (e) => {
    e.preventDefault();
    if (!canCreateTournament) {
      alert('Vetëm liga, klubi ose scout mund të krijojnë turne.');
      return;
    }
    try {
      const payload = {
        ...newTournament,
        name: isLigaCreator ? undefined : newTournament.name,
      };
      await API.post('/tournaments', payload);
      setShowCreateModal(false);
      setNewTournament({
        name: '',
        description: '',
        type: 'knockout',
        startDate: todayDateInputValue(),
        maxParticipants: 8,
        participantType: 'individual',
        category: 'open',
      });
      fetchTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert(error.response?.data?.msg || 'Failed to create tournament');
    }
  };

  const joinTournament = async (tournamentId) => {
    try {
      await API.post(`/tournaments/${tournamentId}/join`);
      alert('Successfully joined tournament!');
      fetchTournaments();
    } catch (error) {
      console.error('Error joining tournament:', error);
      alert(error.response?.data?.msg || 'Failed to join tournament');
    }
  };

  const leaveTournament = async (tournamentId) => {
    if (!window.confirm('Doni të largoheni nga ky turne?')) return;
    try {
      await API.delete(`/tournaments/${tournamentId}/leave`);
      alert('U larguat nga turneu.');
      fetchTournaments();
      if (selectedTournament?.id === tournamentId) {
        setSelectedTournament(null);
      }
    } catch (error) {
      alert(error.response?.data?.msg || 'Nuk u larguat dot nga turneu.');
    }
  };

  const deleteTournament = async (tournamentId) => {
    if (!window.confirm('Fshi këtë turne?')) return;
    try {
      await API.delete(`/tournaments/${tournamentId}`);
      alert('Turneu u fshi.');
      if (selectedTournament?.id === tournamentId) setSelectedTournament(null);
      setEditTournament(null);
      fetchTournaments();
    } catch (error) {
      alert(error.response?.data?.msg || error.response?.data?.error || 'Nuk u fshi turneu.');
    }
  };

  const openEditTournament = (tournament) => {
    setEditTournament(tournament);
    setEditForm({
      name: tournament.name || '',
      description: tournament.description || '',
      type: tournament.type || 'knockout',
      maxParticipants: tournament.maxParticipants || 8,
      category: tournament.category || 'open',
      status: tournament.status || 'open',
    });
  };

  const saveEditTournament = async (e) => {
    e.preventDefault();
    if (!editTournament?.id) return;
    try {
      const isLigaT = !!(editTournament.ligaId || editTournament.sourceRole === 'liga');
      const payload = {
        description: editForm.description,
        type: editForm.type,
        maxParticipants: editForm.maxParticipants,
        category: editForm.category,
        status: editForm.status,
      };
      if (!isLigaT) payload.name = editForm.name;
      await API.put(`/tournaments/${editTournament.id}`, payload);
      setEditTournament(null);
      fetchTournaments();
      alert('Turneu u përditësua.');
    } catch (error) {
      alert(error.response?.data?.msg || 'Nuk u përditësua turneu.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'finished':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'league':
        return '🏆';
      case 'cup':
        return '🏅';
      case 'knockout':
        return '⚔️';
      default:
        return '🎮';
    }
  };

  const filteredTournaments = useMemo(
    () =>
      filterBySearch(tournaments, listSearch, (t) => [
        t.name,
        t.description,
        t.type,
        t.season,
        t.status,
        formatTournamentTitle(t),
      ]),
    [tournaments, listSearch]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-[3px] border-emerald-400 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide text-emerald-200/80">Duke ngarkuar turnetë…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 sm:p-8 shadow-2xl shadow-emerald-900/20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400/90">FootballPro · Competitions</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white tracking-tight">Turnetë</h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300/90 leading-relaxed">
              Ligë, cup dhe knockout — tabela live, raport golash, minuta dhe asiste direkt në profilin e atletit.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-white/10">{tournaments.length} turne</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-white/10">Sezon FIFA</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-white/10">Stats Pro</span>
            </div>
          </div>
          {canCreateTournament && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="shrink-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:scale-[1.02] hover:brightness-110"
            >
              + Krijo turne
            </button>
          )}
        </div>
      </div>

      <ListSearchBar
        value={listSearch}
        onChange={setListSearch}
        placeholder="Kërko turne sipas emrit, sezonit, statusit…"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tournament) => {
          const isCreator = tournament.creatorId === user?.id;
          const participantCount = tournament.participants?.length || 0;
          const isJoined = tournament.participants?.some(
            (p) => resolveParticipantUserId(p) === user?.id
          );
          const pt = tournament.participantType || 'individual';
          const joinBlocked =
            (pt === 'club' && user?.role !== 'club') ||
            (pt === 'mixed' && !['club', 'athlete'].includes(user?.role)) ||
            (pt === 'individual' && user?.role === 'club');

          return (
            <div
              key={tournament.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-black/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getTypeIcon(tournament.type)}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{formatTournamentTitle(tournament)}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      by {tournament.creator?.firstName} {tournament.creator?.lastName}
                    </p>
                  </div>
                </div>
              </div>

              {tournament.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{tournament.description}</p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Lloji</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{tournament.type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Pjesëmarrja</span>
                  <span
                    className={`font-medium rounded px-2 py-0.5 text-xs ${
                      pt === 'club'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                        : pt === 'mixed'
                          ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {pt === 'club' ? 'Vetëm klube' : pt === 'mixed' ? 'Klube + athletë' : 'Individë'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Pjesëmarrës</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {participantCount}/{tournament.maxParticipants}
                  </span>
                </div>
                {tournament.season && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{tournament.type === 'league' ? 'Sezoni' : 'Edicioni'}</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{tournament.season}</span>
                  </div>
                )}
                {tournament.startDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Fillimi</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(tournament.startDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)}`}>
                  {tournament.status.toUpperCase()}
                </span>
                {isCreator && (
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold">
                    CREATOR
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {!isJoined &&
                  tournament.status === 'open' &&
                  participantCount < tournament.maxParticipants &&
                  !joinBlocked && (
                    <button
                      type="button"
                      onClick={() => joinTournament(tournament.id)}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                    {pt === 'club' ? 'Bashkohu si klub' : pt === 'mixed' ? 'Bashkohu (klub ose atlet)' : 'Bashkohu'}
                  </button>
                )}
                {joinBlocked && tournament.status === 'open' && (
                  <p className="text-xs text-center text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg py-2 px-2">
                    {tournament.ligaId || tournament.sourceRole === 'liga'
                      ? 'Për turnet e ligës, klubi bashkohet nga profili i ligës (Bashkohu). Lojtarët hyjnë automatikisht.'
                      : pt === 'club'
                      ? 'Vetëm llogaria e klubit mund të regjistrohet.'
                      : pt === 'mixed'
                        ? 'Vetëm llogaritë «club» ose «athlete» mund të bashkohen.'
                        : 'Llogaritë «klub» përdorni turne «klub» ose «klub + athletë».'}
                  </p>
                )}
                {isJoined && (
                  <div className="space-y-2">
                    <div className="w-full py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-center font-medium">
                      ✓ Në turne
                    </div>
                    {tournament.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => leaveTournament(tournament.id)}
                        className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                      >
                        Largohu
                      </button>
                    )}
                  </div>
                )}
                {isCreator && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditTournament(tournament)}
                      className="py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
                    >
                      Edito
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTournament(tournament.id)}
                      className="py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                      Fshi
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openTournamentModal(tournament, 'overview')}
                    className="py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    Përmbledhje
                  </button>
                  <button
                    type="button"
                    onClick={() => openTournamentModal(tournament, 'table')}
                    className="py-2 border border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-sm font-semibold"
                  >
                    Tabela · pikë
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tournaments.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nuk ka turne</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {canCreateTournament
              ? 'Bëhu i pari që krijon një turne!'
              : 'Turnetë krijohen nga ligat, klubet ose scoutët.'}
          </p>
          {canCreateTournament && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
            >
              Krijo Turne
            </button>
          )}
        </div>
      )}

      {showCreateModal && canCreateTournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Krijo Turne të Ri</h2>

            <form onSubmit={createTournament} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Emri</label>
                {isLigaCreator ? (
                  <p className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm">
                    Turneu i ligës merr automatikisht emrin e ligës suaj.
                  </p>
                ) : (
                  <input
                    type="text"
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`p.sh. Kupa ${APP_BRAND_NAME} U15`}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Përshkrimi</label>
                <textarea
                  value={newTournament.description}
                  onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategoria (edicion)</label>
                <select
                  value={newTournament.category}
                  onChange={(e) => setNewTournament({ ...newTournament, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="senior">Senior</option>
                  <option value="u23">U23</option>
                  <option value="u21">U21</option>
                  <option value="u19">U19</option>
                  <option value="u17">U17</option>
                  <option value="u15">U15</option>
                  <option value="u13">U13</option>
                  <option value="u11">U11</option>
                  <option value="u10">U10</option>
                  <option value="u9">U9</option>
                </select>
              </div>

              {!isLigaCreator && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kush merr pjesë</label>
                <select
                  value={newTournament.participantType}
                  onChange={(e) => setNewTournament({ ...newTournament, participantType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="individual">Individë / talente (pa klub si entitet pjesëmarrës)</option>
                  <option value="club">Vetëm klube (llogari «club»)</option>
                  <option value="mixed">Klube + athletë (të dy rolet mund të bashkohen)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Në «klub + athletë», një turne mund të ketë njëkohësisht klube dhe lojtarë të regjistruar si pjesëmarrës (p.sh. kupa me skuadra dhe individë).
                </p>
              </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lloji i turneut</label>
                <select
                  value={newTournament.type}
                  onChange={(e) => setNewTournament({ ...newTournament, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="knockout">Knockout (⚔️)</option>
                  <option value="league">Ligë — tabelë me pikë (🏆)</option>
                  <option value="cup">Kupë (🏅)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maks. pjesëmarrës</label>
                <select
                  value={newTournament.maxParticipants}
                  onChange={(e) => setNewTournament({ ...newTournament, maxParticipants: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={32}>32</option>
                  {isLigaCreator && <option value={500}>500 (liga)</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data e fillimit</label>
                <input
                  type="date"
                  value={newTournament.startDate}
                  onChange={(e) => setNewTournament({ ...newTournament, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {seasonLabel(newTournament.type)}: {createSeasonPreview || '—'}
                  {newTournament.type === 'league'
                    ? ' · sezon european (gusht–korrik, si FIFA)'
                    : ' · viti i edicionit'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Anulo
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Krijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edito turneun</h2>
            <form onSubmit={saveEditTournament} className="space-y-3">
              {!(editTournament.ligaId || editTournament.sourceRole === 'liga') ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Emri</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Emri i turneut të ligës mbetet emri i ligës.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Përshkrimi</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategoria</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                >
                  {['open', 'senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u10', 'u9'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statusi</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="open">open</option>
                  <option value="ongoing">ongoing</option>
                  <option value="finished">finished</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTournament(null)}
                  className="flex-1 py-2 border rounded-lg"
                >
                  Anulo
                </button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg">
                  Ruaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatTournamentTitle(selectedTournament)}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTournament.creator?.firstName} {selectedTournament.creator?.lastName} ·{' '}
                  <span className="capitalize">{selectedTournament.type}</span>
                  {selectedTournament.season ? ` · ${selectedTournament.season}` : ''} ·{' '}
                  {(selectedTournament.participantType || 'individual') === 'club'
                    ? 'Pjesëmarrje: vetëm klube'
                    : (selectedTournament.participantType || 'individual') === 'mixed'
                      ? 'Pjesëmarrje: klube dhe athletë'
                      : 'Pjesëmarrje: individë'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeMatchModal();
                  setDetailTab('overview');
                  setSelectedTournament(null);
                  setDetailExtras({ standings: null, matches: [], stats: null });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {selectedTournament.description && (
              <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">{selectedTournament.description}</p>
            )}

            {detailLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            )}

            {!detailLoading && (
              <nav
                className="mb-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-900/60"
                aria-label="Seksione turneu"
              >
                {[
                  { id: 'overview', label: 'Përmbledhje' },
                  { id: 'table', label: 'Tabela · pikë' },
                  { id: 'matches', label: 'Ndeshjet' },
                  { id: 'squad', label: 'Pjesëmarrësit' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailTab(id)}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition sm:px-3 sm:text-sm ${
                      detailTab === id
                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}

            {detailTab === 'overview' && !detailLoading && detailExtras.stats && (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-600 dark:bg-gray-900/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ndeshje</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {detailExtras.stats.finishedMatches}/{detailExtras.stats.totalMatches}
                  </p>
                  <p className="text-[10px] text-gray-500">përfunduar</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-600 dark:bg-gray-900/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Gola</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{detailExtras.stats.totalGoals}</p>
                  <p className="text-[10px] text-gray-500">në turne</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-600 dark:bg-gray-900/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Top golashënues</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white" title={detailExtras.stats.topScorerName || ''}>
                    {detailExtras.stats.topScorerName || `#${detailExtras.stats.topScorerId || '—'}`}
                  </p>
                  <p className="text-[10px] text-gray-500">{detailExtras.stats.topScorerGoals} gola</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-600 dark:bg-gray-900/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kryesues pikësh</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white" title={detailExtras.stats.topTeamName || ''}>
                    {detailExtras.stats.topTeamName || `#${detailExtras.stats.topTeamId || '—'}`}
                  </p>
                  <p className="text-[10px] text-gray-500">{detailExtras.stats.topTeamPoints} pikë</p>
                </div>
              </div>
            )}

            {detailTab === 'overview' && !detailLoading && detailExtras.stats?.recentResults?.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Rezultatet e fundit</h3>
                <div className="flex flex-wrap gap-2">
                  {detailExtras.stats.recentResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openMatchDetail(r.id)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs transition hover:border-emerald-500/50 hover:bg-emerald-50/80 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      <span className="block font-mono font-bold text-gray-900 dark:text-white">
                        {r.scoreHome} – {r.scoreAway}
                      </span>
                      <span className="mt-0.5 block max-w-[140px] truncate text-gray-600 dark:text-gray-300">
                        {r.homeName} vs {r.awayName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailTab === 'overview' && !detailLoading && detailExtras.stats && (
              <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-600 dark:bg-gray-900/40">
                <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Përmbledhje turneu</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Pjesëmarrës: {detailExtras.stats.totalParticipants} · Ndeshje gjithsej: {detailExtras.stats.totalMatches} · Në program:{' '}
                  {detailExtras.stats.scheduledMatches ?? '—'} · Mesatarja e golave / ndeshje të përfunduar: {detailExtras.stats.avgGoalsPerMatch}
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Për renditjen sipas pikëve (klube + të tjerë) hap skedën <strong>Tabela · pikë</strong>.
                </p>
              </div>
            )}

            {detailTab === 'table' && !detailLoading && (
              <div className="mb-8">
                <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Tabela — renditja sipas pikëve</h3>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                  {['club', 'mixed'].includes(selectedTournament.participantType || '')
                    ? 'Klubet (dhe athletët në turne «mixed») renditen sipas pikëve në ligë (3-1-0, pastaj diferenca e golave). Në cup/knockout, tabela pasqyron përmbledhjen nga ndeshjet e përfunduara.'
                    : 'Pjesëmarrësit renditen sipas pikëve në ligë; në cup/knockout sipas statistikave të nxjerra nga ndeshjet e përfunduara.'}
                </p>
                {detailExtras.standings?.caption && (
                  <p className="mb-4 text-xs text-gray-500 dark:text-gray-400 border-l-4 border-emerald-500 pl-3">{detailExtras.standings.caption}</p>
                )}
                {detailExtras.standings?.rows?.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Klubi / lojtari</th>
                          <th className="px-3 py-2 text-center">Nd</th>
                          <th className="px-3 py-2 text-center">Fit</th>
                          <th className="px-3 py-2 text-center">Bar</th>
                          <th className="px-3 py-2 text-center">Humb</th>
                          <th className="px-3 py-2 text-center">GF</th>
                          <th className="px-3 py-2 text-center">GA</th>
                          <th className="px-3 py-2 text-center">DG</th>
                          <th className="px-3 py-2 text-center font-semibold">Pkt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailExtras.standings.rows.map((row) => {
                          const u = row.User;
                          const label = u ? participantLabel(u, selectedTournament.participantType || 'individual') : `#${row.userId}`;
                          return (
                            <tr key={row.userId} className="border-t border-gray-100 dark:border-gray-600">
                              <td className="px-3 py-2">{row.rank}</td>
                              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <UserAvatarLink user={u} userId={row.userId} size={32} />
                                  {row.userId ? (
                                    <Link to={`/profile/${row.userId}`} className="hover:text-emerald-700 hover:underline">
                                      {label}
                                    </Link>
                                  ) : (
                                    label
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">{row.played ?? '—'}</td>
                              <td className="px-3 py-2 text-center">{row.wins}</td>
                              <td className="px-3 py-2 text-center">{row.draws}</td>
                              <td className="px-3 py-2 text-center">{row.losses}</td>
                              <td className="px-3 py-2 text-center">{row.goalsFor}</td>
                              <td className="px-3 py-2 text-center">{row.goalsAgainst}</td>
                              <td className="px-3 py-2 text-center">{row.goalDifference}</td>
                              <td className="px-3 py-2 text-center font-semibold">{row.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
                    Ende nuk ka rreshta në tabelë (p.sh. asnjë ndeshje e përfunduar ose turneu sapo filloi). Pas rezultateve, renditja me pikë do të shfaqet këtu.
                  </p>
                )}
              </div>
            )}

            {detailTab === 'matches' && !detailLoading && detailExtras.matches?.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">Të gjitha ndeshjet</h3>
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Kliko një rresht për statistika të plota si ndeshje profesionale.</p>
                <ul className="space-y-2">
                  {detailExtras.matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => openMatchDetail(m.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-3 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-gray-700/80"
                      >
                        <span className="text-gray-500">R{m.round ?? '—'}</span>
                        <span className="min-w-0 flex-1 font-medium text-gray-900 dark:text-white">
                          {participantLabel(m.homeUser, selectedTournament.participantType || 'individual')}
                        </span>
                        <span className="shrink-0 font-mono text-base font-bold text-gray-900 dark:text-white">
                          {m.scoreHome ?? '—'} : {m.scoreAway ?? '—'}
                        </span>
                        <span className="min-w-0 flex-1 text-right font-medium text-gray-900 dark:text-white">
                          {participantLabel(m.awayUser, selectedTournament.participantType || 'individual')}
                        </span>
                        <span className="w-full text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:w-auto sm:text-left">
                          {m.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detailTab === 'matches' && !detailLoading && (!detailExtras.matches || detailExtras.matches.length === 0) && (
              <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">Nuk ka ndeshje të regjistruara për këtë turne.</p>
            )}

            {detailTab === 'squad' && !detailLoading && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Lista e pjesëmarrësve</h3>
                {selectedTournament.participants?.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedTournament.participants.map((participant) => {
                      const uid = resolveParticipantUserId(participant);
                      const label = participantLabel(participant, selectedTournament.participantType || 'individual');
                      return (
                        <div
                          key={uid || `p-${participant.firstName}-${participant.lastName}`}
                          className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700"
                        >
                          <UserAvatarLink
                            user={participant}
                            userId={uid}
                            size={40}
                            name={label}
                          />
                          <div className="min-w-0 flex-1">
                            {uid ? (
                              <Link
                                to={`/profile/${uid}`}
                                className="truncate text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600 hover:underline"
                              >
                                {label}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                            )}
                            {participant.Profile?.club &&
                              ['individual', 'mixed'].includes(selectedTournament.participantType || 'individual') &&
                              participant.role === 'athlete' && (
                                <p className="truncate text-xs text-gray-500">Klubi: {participant.Profile.club}</p>
                              )}
                            {participant.participantStatus && participant.participantStatus !== 'accepted' ? (
                              <p className="text-xs capitalize text-amber-600">{participant.participantStatus}</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">Ende pa pjesëmarrës.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <MatchBroadcastModal
        open={matchModal.open}
        loading={matchModal.loading}
        error={matchModal.error}
        data={matchModal.data}
        participantType={selectedTournament?.participantType || 'individual'}
        onClose={closeMatchModal}
        canEdit={canEditMatch(matchModal.data?.match)}
        participants={selectedTournament?.participants || []}
        onSaveMatch={saveMatchReport}
        saving={savingMatch}
      />
    </div>
    </div>
  );
}
