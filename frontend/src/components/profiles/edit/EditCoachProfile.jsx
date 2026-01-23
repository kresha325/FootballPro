import React, { useEffect, useState } from 'react';
import { profileAPI } from '../../../services/api';

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

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto || '');
  const [clubSuggestions, setClubSuggestions] = useState([]);
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [clubQuery, setClubQuery] = useState(user.club || '');
  const [selectedClubId, setSelectedClubId] = useState(null);

  useEffect(() => {
    const query = clubQuery.trim();
    if (!query) {
      setClubSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await profileAPI.getAllProfiles({ role: 'club', search: query, limit: 6 });
        const results = res.data || [];
        setClubSuggestions(results);
        const exact = results.find((club) => {
          const label = (club.club || `${club.firstName || ''} ${club.lastName || ''}`.trim()).toLowerCase();
          return label === query.toLowerCase();
        });
        if (exact) {
          setSelectedClubId(exact.userId || exact.id);
        }
      } catch (err) {
        setClubSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [clubQuery]);

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
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });
    if (selectedClubId) {
      formData.append('clubId', selectedClubId);
    }
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Profile Photo</label>
        {preview && (
          <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-2" />
        )}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
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
          <div className="relative">
            <input
              name="club"
              value={form.club}
              onChange={(e) => {
                handleChange(e);
                setClubQuery(e.target.value);
                setShowClubSuggestions(true);
                setSelectedClubId(null);
              }}
              onFocus={() => setShowClubSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClubSuggestions(false), 150)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Shkruaj emrin e klubit"
              autoComplete="off"
            />
            {showClubSuggestions && clubSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-sm max-h-48 overflow-y-auto">
                {clubSuggestions.map((club) => {
                  const label = club.club || `${club.firstName || ''} ${club.lastName || ''}`.trim();
                  return (
                    <button
                      type="button"
                      key={club.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      onMouseDown={() => {
                        setForm((prev) => ({ ...prev, club: label }));
                        setClubQuery(label);
                        setSelectedClubId(club.userId || club.id);
                        setShowClubSuggestions(false);
                      }}
                    >
                      {label || 'Club'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
