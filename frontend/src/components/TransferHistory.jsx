import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI, transferHistoryAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function currentSeasonLabel(now = new Date()) {
  const y = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

function clubLabel(club) {
  if (!club) return '';
  return (
    club.club ||
    `${club.firstName || ''} ${club.lastName || ''}`.trim() ||
    club.email ||
    'Club'
  );
}

function statusBadge(transfer) {
  const status = String(transfer?.status || 'confirmed').toLowerCase();
  if (status === 'pending') {
    const fromOk = !transfer.fromClubUserId || transfer.fromClubConfirmedAt;
    const toOk = Boolean(transfer.toClubConfirmedAt);
    return {
      label: `Në pritje (${fromOk ? '✓' : '…'} nisës · ${toOk ? '✓' : '…'} destinacion)`,
      className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Refuzuar',
      className: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
    };
  }
  return {
    label: 'I konfirmuar',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  };
}

function ClubAutocomplete({
  label,
  required,
  value,
  onChange,
  clubUserId,
  onSelectClub,
  placeholder,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = String(value || '').trim();
    if (query.length < 1) {
      setSuggestions([]);
      return undefined;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await profileAPI.getAllProfiles({ role: 'club', search: query, limit: 8 });
        setSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch (_err) {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [value]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onSelectClub(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        required={required}
        autoComplete="off"
      />
      {clubUserId ? (
        <p className="mt-1 text-xs text-teal-700 dark:text-teal-300">Klub i regjistruar ✓</p>
      ) : value?.trim() ? (
        <p className="mt-1 text-xs text-gray-500">Tekst i lirë (ose zgjidh nga lista e klubeve)</p>
      ) : null}
      {open && suggestions.length > 0 ? (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((club) => {
            const name = clubLabel(club);
            const id = club.userId || club.id;
            return (
              <button
                type="button"
                key={String(id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  onSelectClub(id);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{name}</span>
                {club.city || club.country ? (
                  <span className="text-gray-500 text-xs ml-2">
                    {[club.city, club.country].filter(Boolean).join(', ')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ClubName({ name, userId }) {
  if (!name) return <span>Free Agent</span>;
  if (userId) {
    return (
      <Link to={`/profile/${userId}`} className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
        {name}
      </Link>
    );
  }
  return <span className="font-semibold text-gray-900 dark:text-white">{name}</span>;
}

function isCurrentClubStint(transfer) {
  return (
    transfer?.notes === '__current_club__' ||
    String(transfer?.contractUntil || '').toLowerCase() === 'vazhdon'
  );
}

const emptyForm = () => ({
  transferType: 'player_transfer',
  fromClub: '',
  toClub: '',
  fromClubUserId: null,
  toClubUserId: null,
  position: '',
  season: currentSeasonLabel(),
  transferDate: '',
  transferFee: '',
  contractUntil: '',
  notes: '',
});

const TransferHistory = ({ userId, isOwner, onChanged }) => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [clubPending, setClubPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const isClub = String(user?.role || '').toLowerCase() === 'club';
  const myClubId = user?.id != null ? Number(user.id) : null;

  const sortedTransfers = useMemo(() => {
    return [...(transfers || [])].sort((a, b) => {
      const da = new Date(a.transferDate || 0).getTime();
      const db = new Date(b.transferDate || 0).getTime();
      return db - da;
    });
  }, [transfers]);

  useEffect(() => {
    fetchTransfers();
  }, [userId]);

  useEffect(() => {
    if (!isClub) {
      setClubPending([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await transferHistoryAPI.getPendingForClub();
        if (!cancelled) setClubPending(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setClubPending([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClub, user?.id]);

  const fetchTransfers = async () => {
    if (!userId) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    try {
      const response = await transferHistoryAPI.getUserTransfers(userId);
      setTransfers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshClubPending = async () => {
    if (!isClub) return;
    try {
      const res = await transferHistoryAPI.getPendingForClub();
      setClubPending(Array.isArray(res.data) ? res.data : []);
    } catch {
      setClubPending([]);
    }
  };

  const handleAddTransfer = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.toClub.trim()) {
      setFormError('To Club është i detyrueshëm.');
      return;
    }
    if (!form.toClubUserId && ['player_transfer', 'loan'].includes(form.transferType)) {
      setFormError('Zgjidh klubin destinacion nga lista e klubeve (jo vetëm emrin), që të mund të konfirmojë.');
      return;
    }
    if (form.fromClub.trim() && !form.fromClubUserId && ['player_transfer', 'loan'].includes(form.transferType)) {
      setFormError('Zgjidh klubin nisës nga lista, ose lëre bosh për Free agent.');
      return;
    }
    if (!form.season.trim()) {
      setFormError('Season është i detyrueshëm.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        transferType: form.transferType,
        fromClub: form.fromClub.trim() || null,
        toClub: form.toClub.trim(),
        fromClubUserId: form.fromClubUserId || null,
        toClubUserId: form.toClubUserId || null,
        position: form.position.trim() || null,
        season: form.season.trim(),
        transferDate: form.transferDate || undefined,
        transferFee: form.transferFee.trim() || null,
        contractUntil: form.contractUntil.trim() || null,
        notes: form.notes.trim() || null,
      };
      await transferHistoryAPI.addTransfer(payload);
      setShowAddModal(false);
      setForm(emptyForm());
      await fetchTransfers();
      onChanged?.();
    } catch (error) {
      console.error('Error adding transfer:', error);
      const apiMsg =
        error?.response?.data?.msg ||
        error?.response?.data?.errors?.[0]?.msg ||
        error?.response?.data?.error ||
        'Failed to add transfer';
      setFormError(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (transferId) => {
    setActionId(transferId);
    try {
      await transferHistoryAPI.confirmTransfer(transferId);
      await fetchTransfers();
      await refreshClubPending();
      onChanged?.();
    } catch (error) {
      alert(error?.response?.data?.msg || 'Konfirmimi dështoi');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (transferId) => {
    if (!confirm('Refuzo këtë transfer?')) return;
    setActionId(transferId);
    try {
      await transferHistoryAPI.rejectTransfer(transferId);
      await fetchTransfers();
      await refreshClubPending();
      onChanged?.();
    } catch (error) {
      alert(error?.response?.data?.msg || 'Refuzimi dështoi');
    } finally {
      setActionId(null);
    }
  };

  const canActAsClub = (transfer) => {
    if (!isClub || myClubId == null || String(transfer?.status) !== 'pending') return false;
    return (
      Number(transfer.fromClubUserId) === myClubId || Number(transfer.toClubUserId) === myClubId
    );
  };

  const mySideConfirmed = (transfer) => {
    if (Number(transfer.fromClubUserId) === myClubId) return Boolean(transfer.fromClubConfirmedAt);
    if (Number(transfer.toClubUserId) === myClubId) return Boolean(transfer.toClubConfirmedAt);
    return false;
  };

  const handleDeleteTransfer = async (transferId) => {
    if (!confirm('Are you sure you want to delete this transfer record?')) return;
    try {
      await transferHistoryAPI.deleteTransfer(transferId);
      await fetchTransfers();
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert(error?.response?.data?.msg || 'Failed to delete transfer');
    }
  };

  const getTransferIcon = (type) => {
    const icons = {
      player_transfer: '⚽',
      coach_appointment: '📋',
      staff_appointment: '👔',
      loan: '🔄',
    };
    return icons[type] || '📍';
  };

  if (loading) return <div className="animate-pulse">Loading transfers...</div>;

  const renderClubActions = (transfer) => {
    if (!canActAsClub(transfer)) return null;
    if (mySideConfirmed(transfer)) {
      return (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Klubi yt e konfirmoi
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={actionId === transfer.id}
          onClick={() => handleConfirm(transfer.id)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-60"
        >
          Konfirmo
        </button>
        <button
          type="button"
          disabled={actionId === transfer.id}
          onClick={() => handleReject(transfer.id)}
          className="px-3 py-1.5 rounded-lg border border-red-400 text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60"
        >
          Refuzo
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>🔄</span> Transfer History
        </h3>
        {isOwner && !isClub ? (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setFormError('');
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            + Add Transfer
          </button>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Transferet e reja kërkojnë konfirmim nga <strong>të dy klubet</strong> (nisës + destinacion). Klubi aktual ndryshon vetëm pasi të dyja palët konfirmojnë.
      </p>

      {isClub && clubPending.length > 0 ? (
        <div className="mb-5 rounded-xl border border-amber-300/50 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Transfere në pritje për klubin tënd ({clubPending.length})
          </h4>
          <ul className="space-y-3">
            {clubPending.map((t) => {
              const athlete = t.User || t.user;
              const name = athlete
                ? `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim()
                : `Atleti #${t.userId}`;
              return (
                <li
                  key={`pending-${t.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-amber-200/60 bg-white/70 p-3 dark:border-amber-500/20 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link to={`/profile/${t.userId}`} className="font-bold text-gray-900 hover:underline dark:text-white">
                      {name}
                    </Link>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {t.fromClub || 'Free agent'} → {t.toClub} · {t.season}
                    </p>
                  </div>
                  {renderClubActions(t)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sortedTransfers.length === 0 ? (
        !(isClub && clubPending.length > 0) ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {isClub ? 'Nuk ka transfere në pritje për klubin tënd' : 'No transfer history'}
          </p>
        ) : null
      ) : (
        <div className="space-y-4">
          {sortedTransfers.map((transfer) => (
            <div
              key={transfer.id}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-3xl">{getTransferIcon(transfer.transferType)}</div>
                  <div className="flex-1 min-w-0">
                    {isCurrentClubStint(transfer) ? (
                      <>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <ClubName name={transfer.toClub} userId={transfer.toClubUserId} />
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                            Klubi aktual
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>📅 {transfer.season || '—'} · vazhdon</span>
                          {transfer.position && <span>⚽ {transfer.position}</span>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {transfer.fromClub ? (
                            <>
                              <ClubName name={transfer.fromClub} userId={transfer.fromClubUserId} />
                              <span className="text-gray-400">→</span>
                            </>
                          ) : null}
                          <ClubName name={transfer.toClub} userId={transfer.toClubUserId} />
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge(transfer).className}`}
                          >
                            {statusBadge(transfer).label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>📅 {transfer.season}</span>
                          {transfer.position && <span>⚽ {transfer.position}</span>}
                          {transfer.transferFee && <span>💰 {transfer.transferFee}</span>}
                          {transfer.contractUntil &&
                          String(transfer.contractUntil).toLowerCase() !== 'vazhdon' ? (
                            <span>📝 Until {transfer.contractUntil}</span>
                          ) : null}
                          {transfer.transferDate ? (
                            <span>
                              🗓{' '}
                              {new Date(transfer.transferDate).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : null}
                        </div>
                        {transfer.notes && transfer.notes !== '__current_club__' ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{transfer.notes}</p>
                        ) : null}
                        {canActAsClub(transfer) ? (
                          <div className="mt-3">{renderClubActions(transfer)}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTransfer(transfer.id)}
                    className="text-red-600 hover:text-red-700 p-2"
                    title="Delete"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Transfer Record</h3>
            {formError ? (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {formError}
              </div>
            ) : null}
            <form onSubmit={handleAddTransfer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Type</label>
                  <select
                    value={form.transferType}
                    onChange={(e) => setForm({ ...form, transferType: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="player_transfer">Player Transfer</option>
                    <option value="coach_appointment">Coach Appointment</option>
                    <option value="staff_appointment">Staff Appointment</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Season *</label>
                  <input
                    type="text"
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                    placeholder="e.g., 2026-2027"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <ClubAutocomplete
                  label="From Club"
                  value={form.fromClub}
                  clubUserId={form.fromClubUserId}
                  onChange={(fromClub) => setForm((f) => ({ ...f, fromClub }))}
                  onSelectClub={(fromClubUserId) => setForm((f) => ({ ...f, fromClubUserId }))}
                  placeholder="Previous club or Free Agent"
                />
                <ClubAutocomplete
                  label="To Club"
                  required
                  value={form.toClub}
                  clubUserId={form.toClubUserId}
                  onChange={(toClub) => setForm((f) => ({ ...f, toClub }))}
                  onSelectClub={(toClubUserId) => setForm((f) => ({ ...f, toClubUserId }))}
                  placeholder="New club"
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Position/Role</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g., Striker, Head Coach"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Date</label>
                  <input
                    type="date"
                    value={form.transferDate}
                    onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Fee</label>
                  <input
                    type="text"
                    value={form.transferFee}
                    onChange={(e) => setForm({ ...form, transferFee: e.target.value })}
                    placeholder="e.g., Free, €5M, Loan"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contract Until</label>
                  <input
                    type="text"
                    value={form.contractUntil}
                    onChange={(e) => setForm({ ...form, contractUntil: e.target.value })}
                    placeholder="e.g., 2026"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional details"
                  rows="3"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                Transferi mbetet <strong>në pritje</strong> derisa klubi nisës dhe klubi destinacion ta konfirmojnë.
                Klubi aktual ndryshon vetëm pas konfirmimit të dyanshëm. Free agent: mjafton konfirmimi i klubit destinacion.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition font-medium"
                >
                  {saving ? 'Duke ruajtur…' : 'Dërgo për konfirmim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferHistory;
