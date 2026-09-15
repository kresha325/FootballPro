import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';

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
  photo: '',
  featured: false,
  days: '7',
};

export default function AdminStadiums() {
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [clearPhoto, setClearPhoto] = useState(false);

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
    setPhotoFile(null);
    setPhotoPreview('');
    setClearPhoto(false);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setClearPhoto(false);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      window.alert('Emri i stadiumit është i detyrueshëm.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('city', form.city.trim());
      fd.append('country', form.country.trim());
      fd.append('capacity', form.capacity === '' ? '' : String(form.capacity));
      fd.append('address', form.address.trim());
      fd.append('featured', form.featured ? 'true' : 'false');
      if (form.featured) {
        fd.append('days', form.days === '' ? '7' : String(form.days));
      }
      if (photoFile) {
        fd.append('photo', photoFile);
      } else if (clearPhoto) {
        fd.append('clearPhoto', '1');
      } else if (form.photo && /^https?:\/\//i.test(form.photo.trim())) {
        fd.append('photo', form.photo.trim());
      }

      if (editingId) {
        await api.put(`/stadiums/${editingId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/stadiums', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
    let daysLeft = '7';
    if (s.featured && s.featuredStart && s.featuredEnd) {
      const ms = new Date(s.featuredEnd) - new Date();
      const d = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      daysLeft = String(d);
    }
    setForm({
      name: s.name || '',
      city: s.city || '',
      country: s.country || '',
      capacity: s.capacity != null ? String(s.capacity) : '',
      address: s.address || '',
      photo: s.photo || '',
      featured: Boolean(s.featured),
      days: daysLeft,
    });
    setPhotoFile(null);
    setClearPhoto(false);
    setPhotoPreview(s.photo ? getFullUrl(s.photo) : '');
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

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setForm((prev) => ({ ...prev, photo: '' }));
    if (editingId) setClearPhoto(true);
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" encType="multipart/form-data">
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Foto e stadiumit</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Stadium"
                  className="w-40 h-28 object-cover rounded-lg border border-gray-200 bg-slate-50"
                />
              ) : (
                <div className="w-40 h-28 rounded-lg border border-dashed border-gray-300 bg-slate-50 flex items-center justify-center text-xs text-gray-400">
                  Pa foto
                </div>
              )}
              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block w-full text-sm text-gray-600"
                />
                <input
                  type="url"
                  value={!photoFile ? form.photo : ''}
                  onChange={(e) => {
                    setPhotoFile(null);
                    setClearPhoto(false);
                    setForm({ ...form, photo: e.target.value });
                    setPhotoPreview(e.target.value ? getFullUrl(e.target.value) : '');
                  }}
                  placeholder="ose ngjit URL të fotos (https://…)"
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
                {(photoPreview || form.photo) && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Hiq foton
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-slate-50 p-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="rounded border-gray-300"
              />
              Shfaq në Feed
            </label>
            {form.featured ? (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Ditë (duration)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                  className="w-24 p-2 border border-gray-300 rounded"
                />
              </div>
            ) : null}
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
                  <th className="py-2 pr-4">Foto</th>
                  <th className="py-2 pr-4">Emri</th>
                  <th className="py-2 pr-4">Qyteti</th>
                  <th className="py-2 pr-4">Kapaciteti</th>
                  <th className="py-2 pr-4">Feed</th>
                  <th className="py-2 pr-4">Veprime</th>
                </tr>
              </thead>
              <tbody>
                {stadiums.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4">
                      {s.photo ? (
                        <img
                          src={getFullUrl(s.photo)}
                          alt=""
                          className="w-14 h-10 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{s.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {s.capacity != null ? Number(s.capacity).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {s.featured ? (
                        <span className="text-green-700 font-medium">Po</span>
                      ) : (
                        <span className="text-gray-400">Jo</span>
                      )}
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
