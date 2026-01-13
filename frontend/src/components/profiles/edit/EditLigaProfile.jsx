import React, { useState } from 'react';

const EditLigaProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    name: user.name || '',
    logo: user.logo || '',
    country: user.country || '',
    level: user.level || '',
    foundedYear: user.foundedYear || '',
    description: user.description || '',
    website: user.website || '',
    clubs: user.clubs || [],
    competitions: user.competitions || [],
    contact: user.contact || {},
    socialLinks: user.socialLinks || {},
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-semibold mb-3">Liga Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input name="logo" value={form.logo} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Level</label>
          <select name="level" value={form.level} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Level</option>
            <option value="national">National</option>
            <option value="regional">Regional</option>
            <option value="youth">Youth</option>
            <option value="women">Women</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Founded Year</label>
          <input name="foundedYear" value={form.foundedYear} onChange={handleChange} type="number" className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <input name="website" value={form.website} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Clubs (comma separated)</label>
        <input name="clubs" value={form.clubs} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Competitions (comma separated)</label>
        <input name="competitions" value={form.competitions} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contact (JSON)</label>
        <textarea name="contact" value={JSON.stringify(form.contact)} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Social Links (JSON)</label>
        <textarea name="socialLinks" value={JSON.stringify(form.socialLinks)} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {errors && errors.general && <div className="text-red-500 mt-2">{errors.general}</div>}
    </form>
  );
};

export default EditLigaProfile;
