import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

function apiError(error, fallback = 'Veprimi dështoi') {
  return (
    error?.response?.data?.msg ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

const emptyForm = {
  name: '',
  description: '',
  type: 'league',
  status: 'open',
  season: '',
  maxParticipants: '',
  participantType: 'individual',
  startDate: '',
  endDate: '',
};

function toDateInput(value) {
  if (!value) return '';
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer admin endpoint; fall back to /tournaments (same model) if Render
      // has not redeployed the new /admin/tournaments routes yet.
      let list = [];
      try {
        const res = await api.get('/admin/tournaments', {
          params: {
            q: search || undefined,
            status: statusFilter || undefined,
            type: typeFilter || undefined,
            limit: 200,
          },
        });
        list = Array.isArray(res.data?.tournaments) ? res.data.tournaments : [];
      } catch (adminErr) {
        if (adminErr?.response?.status !== 404) throw adminErr;
        const res = await api.get('/tournaments');
        list = Array.isArray(res.data) ? res.data : [];
        const q = search.trim().toLowerCase();
        if (q) {
          list = list.filter(
            (t) =>
              String(t.name || '')
                .toLowerCase()
                .includes(q) ||
              String(t.description || '')
                .toLowerCase()
                .includes(q) ||
              String(t.season || '')
                .toLowerCase()
                .includes(q)
          );
        }
        if (statusFilter) list = list.filter((t) => t.status === statusFilter);
        if (typeFilter) list = list.filter((t) => t.type === typeFilter);
      }
      setTournaments(list);
    } catch (error) {
      window.alert(apiError(error, 'Nuk u ngarkuan turnetë'));
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      description: t.description || '',
      type: t.type || 'league',
      status: t.status || 'open',
      season: t.season || '',
      maxParticipants: t.maxParticipants != null ? String(t.maxParticipants) : '',
      participantType: t.participantType || 'individual',
      startDate: toDateInput(t.startDate),
      endDate: toDateInput(t.endDate),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!form.name.trim()) {
      window.alert('Emri i turneut është i detyrueshëm.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description,
      type: form.type,
      status: form.status,
      season: form.season || null,
      maxParticipants: form.maxParticipants === '' ? null : Number(form.maxParticipants),
      participantType: form.participantType,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    try {
      try {
        await api.put(`/admin/tournaments/${editingId}`, payload);
      } catch (adminErr) {
        if (adminErr?.response?.status !== 404) throw adminErr;
        await api.put(`/tournaments/${editingId}`, payload);
      }
      resetForm();
      await fetchTournaments();
    } catch (error) {
      window.alert(apiError(error, 'Ruajtja e turneut dështoi'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Fshi turneun "${t.name}"? Kjo fshin edhe ndeshjet dhe pjesëmarrësit.`)) return;
    try {
      try {
        await api.delete(`/admin/tournaments/${t.id}`);
      } catch (adminErr) {
        if (adminErr?.response?.status !== 404) throw adminErr;
        await api.delete(`/tournaments/${t.id}`);
      }
      if (editingId === t.id) resetForm();
      await fetchTournaments();
    } catch (error) {
      window.alert(apiError(error, 'Fshirja e turneut dështoi'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId ? `Ndrysho turneun #${editingId}` : 'Menaxhimi i turneve'}
        </h2>
        {editingId ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-gray-700">Emri</span>
              <input
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Sezoni</span>
              <input
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.season}
                onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                placeholder="2025/2026"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Lloji</span>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="knockout">Knockout</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Statusi</span>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="open">Open</option>
                <option value="ongoing">Ongoing</option>
                <option value="finished">Finished</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Pjesëmarrës</span>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.participantType}
                onChange={(e) => setForm((f) => ({ ...f, participantType: e.target.value }))}
              >
                <option value="individual">Individual</option>
                <option value="club">Club</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Max pjesëmarrës</span>
              <input
                type="number"
                min="0"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.maxParticipants}
                onChange={(e) => setForm((f) => ({ ...f, maxParticipants: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Fillimi</span>
              <input
                type="date"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Mbarimi</span>
              <input
                type="date"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-gray-700">Përshkrimi</span>
              <textarea
                rows={3}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Duke ruajtur…' : 'Ruaj ndryshimet'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Anulo
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">Zgjidh «Ndrysho» nga lista për të edituar një turne.</p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Kërko sipas emrit, sezonit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Të gjitha statuset</option>
            <option value="open">Open</option>
            <option value="ongoing">Ongoing</option>
            <option value="finished">Finished</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Të gjitha llojet</option>
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="knockout">Knockout</option>
          </select>
          <button
            type="button"
            onClick={fetchTournaments}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Rifresko
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Duke ngarkuar…</p>
        ) : tournaments.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Nuk ka turne.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Emri</th>
                  <th className="py-2 pr-3">Lloji</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sezon</th>
                  <th className="py-2 pr-3">Krijuesi</th>
                  <th className="py-2 pr-3">Veprime</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-500">{t.id}</td>
                    <td className="py-2 pr-3 font-medium text-gray-900">{t.name}</td>
                    <td className="py-2 pr-3">{t.type}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          t.status === 'open'
                            ? 'bg-green-100 text-green-800'
                            : t.status === 'ongoing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{t.season || '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">
                      {t.creator
                        ? `${t.creator.firstName || ''} ${t.creator.lastName || ''}`.trim() ||
                          t.creator.email
                        : '—'}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Ndrysho
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="text-red-600 hover:underline"
                      >
                        Fshi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
