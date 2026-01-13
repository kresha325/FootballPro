import React, { useState } from 'react';

const EditAthleteProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    bio: user.bio || '',
    position: user.position || '',
    club: user.club || '',
    city: user.city || '',
    country: user.country || '',
    height: user.stats?.height || '',
    weight: user.stats?.weight || '',
    preferredFoot: user.stats?.preferredFoot || 'right',
    jerseyNumber: user.stats?.jerseyNumber || '',
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
      <h3 className="text-lg font-semibold mb-3">Athlete Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">First Name *</label>
          <input name="firstName" value={form.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name *</label>
          <input name="lastName" value={form.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select name="gender" value={form.gender} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={500} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Position</label>
          <select name="position" value={form.position} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Position</option>
            <option value="Goalkeeper">Goalkeeper</option>
            <option value="Defender">Defender</option>
            <option value="Midfielder">Midfielder</option>
            <option value="Forward">Forward</option>
            <option value="Winger">Winger</option>
            <option value="Striker">Striker</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Club</label>
          <input name="club" value={form.club} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jersey Number</label>
          <input name="jerseyNumber" value={form.jerseyNumber} onChange={handleChange} type="number" min="1" max="99" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Preferred Foot</label>
          <select name="preferredFoot" value={form.preferredFoot} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Height (cm)</label>
          <input name="height" value={form.height} onChange={handleChange} type="number" placeholder="175" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Weight (kg)</label>
          <input name="weight" value={form.weight} onChange={handleChange} type="number" placeholder="70" className="w-full p-2 border border-gray-300 rounded" />
        </div>
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

export default EditAthleteProfile;
