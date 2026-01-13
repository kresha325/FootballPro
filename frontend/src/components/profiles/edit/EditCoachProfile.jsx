import React, { useState } from 'react';

const EditCoachProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    bio: user.bio || '',
    club: user.club || '',
    coachAffiliation: user.coachAffiliation || '',
    coachCategory: user.coachCategory || '',
    city: user.city || '',
    country: user.country || '',
    careerHistory: user.careerHistory || '',
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
      <h3 className="text-lg font-semibold mb-3">Coach Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">First Name *</label>
          <input name="firstName" value={form.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name *</label>
          <input name="lastName" value={form.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={500} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Club</label>
          <input name="club" value={form.club} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Affiliation</label>
          <select name="coachAffiliation" value={form.coachAffiliation} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Affiliation</option>
            <option value="club">Club Trainer</option>
            <option value="independent">Independent</option>
            <option value="personal_trainer">Personal Trainer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select name="coachCategory" value={form.coachCategory} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Category</option>
            <option value="general_trainer">General Trainer</option>
            <option value="assistant_trainer">Assistant Trainer</option>
            <option value="fitness_trainer">Fitness/Conditional Trainer</option>
            <option value="goalkeeper_trainer">Goalkeeper Trainer</option>
            <option value="technical_trainer">Technical Trainer</option>
            <option value="tactical_trainer">Tactical Trainer</option>
            <option value="psychological_trainer">Psychological Trainer</option>
            <option value="youth_trainer">Youth Trainer</option>
            <option value="rehabilitation_trainer">Rehabilitation Trainer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Career History</label>
          <textarea name="careerHistory" value={form.careerHistory} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
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

export default EditCoachProfile;
