import React, { useState } from 'react';

function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function listToCsv(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        return item.name || item.title || '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (value == null) return '';
  return String(value);
}

function csvToList(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const EditLigaProfile = ({ user, onSave, loading, errors }) => {
  const contact = asObject(user.contact);
  const social = asObject(user.socialLinks);
  const [form, setForm] = useState({
    name: user.name || user.club || '',
    logo: user.logo || '',
    country: user.country || '',
    level: user.level || '',
    foundedYear: user.foundedYear || '',
    description: user.description || user.bio || '',
    website: user.website || contact.website || '',
    competitions: listToCsv(user.competitions),
    phone: contact.phone || '',
    email: contact.email || '',
    contactWebsite: contact.website || user.website || '',
    instagram: social.instagram || contact.instagram || '',
    facebook: social.facebook || contact.facebook || '',
    twitter: social.twitter || contact.twitter || '',
    youtube: social.youtube || '',
    linkedin: social.linkedin || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto || user.logo || '');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfilePhoto(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', form.name || '');
    formData.append('logo', form.logo || '');
    formData.append('country', form.country || '');
    formData.append('level', form.level || '');
    formData.append('foundedYear', form.foundedYear || '');
    formData.append('description', form.description || '');
    formData.append('website', form.website || form.contactWebsite || '');
    formData.append('competitions', JSON.stringify(csvToList(form.competitions)));
    formData.append(
      'contact',
      JSON.stringify({
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.contactWebsite || form.website || undefined,
      })
    );
    formData.append(
      'socialLinks',
      JSON.stringify({
        instagram: form.instagram || undefined,
        facebook: form.facebook || undefined,
        twitter: form.twitter || undefined,
        youtube: form.youtube || undefined,
        linkedin: form.linkedin || undefined,
      })
    );
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Foto e profilit</label>
        {preview ? <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-2" /> : null}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <h3 className="text-lg font-semibold mb-3">Profili i Ligës</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Emri *</label>
          <input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input name="logo" value={form.logo} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Shteti</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Niveli</label>
          <select name="level" value={form.level} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Zgjidh nivelin</option>
            <option value="national">National</option>
            <option value="regional">Regional</option>
            <option value="youth">Youth</option>
            <option value="women">Women</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Viti i themelimit</label>
          <input name="foundedYear" value={form.foundedYear} onChange={handleChange} type="number" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input name="website" value={form.website} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Përshkrimi</label>
        <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Kompeticionet</label>
        <input
          name="competitions"
          value={form.competitions}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="p.sh. Liga e Parë, Kupa e Kosovës"
        />
        <p className="mt-1 text-xs text-gray-500">Ndaji me presje. Klubet menaxhohen nga profili (Bashkohu / Hiq).</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Kontakt</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Telefon</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="+383 ..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Website (kontakt)</label>
            <input name="contactWebsite" value={form.contactWebsite} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://" />
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Rrjetet sociale</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Instagram</label>
            <input name="instagram" value={form.instagram} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Facebook</label>
            <input name="facebook" value={form.facebook} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Twitter / X</label>
            <input name="twitter" value={form.twitter} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://x.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">YouTube</label>
            <input name="youtube" value={form.youtube} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://youtube.com/..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LinkedIn</label>
            <input name="linkedin" value={form.linkedin} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" placeholder="https://linkedin.com/..." />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Duke ruajtur…' : 'Ruaj ndryshimet'}
        </button>
      </div>
      {errors?.general ? <div className="text-red-600 mt-2">{errors.general}</div> : null}
    </form>
  );
};

export default EditLigaProfile;
