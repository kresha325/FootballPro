import React, { useState } from 'react';

const EditClubProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    club: user.club || '',
    city: user.city || '',
    country: user.country || '',
    bio: user.bio || '',
    careerHistory: user.careerHistory || '',
    contact: user.contact || {},
    profilePhoto: user.profilePhoto || '',
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
      <h3 className="text-lg font-semibold mb-3">Club Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Club Name</label>
          <input name="club" value={form.club} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Career History</label>
        <textarea name="careerHistory" value={form.careerHistory} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contact (JSON)</label>
        <textarea name="contact" value={JSON.stringify(form.contact)} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
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

export default EditClubProfile;
