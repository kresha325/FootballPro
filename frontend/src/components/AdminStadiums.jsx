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
  city: '',
  country: 'Kosovë',
  capacity: '',
  address: '',
};

export default function AdminStadiums() {
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchStadiums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stadiums', { params: { q: search || undefined, limit: 200 } });
      setStadiums(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      window.alert(apiError(error, 'Nuk u ngarkuan stadiumet'));
      setStadiums([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchStadiums();
  }, [fetchStadiums]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      window.alert('Emri i stadiumit është i detyrueshëm.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        capacity: form.capacity === '' ? null : form.capacity,
        address: form.address.trim() || null,
      };
      if (editingId) {
        await api.put(`/stadiums/${editingId}`, payload);
      } else {
        await api.post('/stadiums', payload);
      }
      resetForm();
      await fetchStadiums();
    } catch (error) {
      window.alert(apiError(error, 'Ruajtja e stadiumit dështoi'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name || '',
      city: s.city || '',
      country: s.country || '',
      capacity: s.capacity != null ? String(s.capacity) : '',
      address: s.address || '',
    });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Fshi stadiumin «${name}»?`)) return;
    try {
      await api.delete(`/stadiums/${id}`);
      if (editingId === id) resetForm();
      await fetchStadiums();
    } catch (error) {
      window.alert(apiError(error, 'Fshirja dështoi'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {editingId ? 'Edito stadiumin' : 'Shto stadium'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Katalogu i stadiumeve — klubet i zgjedhin nga Edit Profile.
        </p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Emri *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="p.sh. Stadiumi Përparim Thaçi"
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qyteti</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Prizren"
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shteti</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kapaciteti</label>
            <input
              type="number"
              min="0"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              placeholder="8500"
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresa</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Duke ruajtur…' : editingId ? 'Përditëso' : 'Shto stadium'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Anulo
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Stadiumet ({stadiums.length})</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kërko stadium…"
            className="p-2 border border-gray-300 rounded w-full sm:w-64"
          />
        </div>
        {loading ? (
          <p className="text-gray-500">Duke ngarkuar…</p>
        ) : stadiums.length === 0 ? (
          <p className="text-gray-500">Nuk ka stadiume ende.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 pr-4">Emri</th>
                  <th className="py-2 pr-4">Qyteti</th>
                  <th className="py-2 pr-4">Kapaciteti</th>
                  <th className="py-2 pr-4">Veprime</th>
                </tr>
              </thead>
              <tbody>
                {stadiums.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{s.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {s.capacity != null ? Number(s.capacity).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4 space-x-2">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-blue-600 hover:underline"
                      >
                        Edito
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, s.name)}
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
