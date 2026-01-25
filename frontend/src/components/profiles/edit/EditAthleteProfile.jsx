import React, { useEffect, useState } from 'react';
import { clubMembersAPI, profileAPI } from '../../../services/api';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    // Fushat që shkojnë te User/Profile direkt
    const directFields = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'bio', 'position', 'club', 'clubLogo', 'city', 'country'
    ];
    directFields.forEach(field => {
      if (form[field] !== undefined) formData.append(field, form[field]);
    });
    if (selectedClubId) {
      formData.append('clubId', selectedClubId);
    }
    // Paketoj fushat e statistikave si objekt stats
    const stats = {
      height: form.height,
      weight: form.weight,
      preferredFoot: form.preferredFoot,
      jerseyNumber: form.jerseyNumber
    };
    formData.append('stats', JSON.stringify(stats));
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    await onSave(formData);

    const trimmedClub = form.club?.trim();
    if (trimmedClub) {
      try {
        await clubMembersAPI.requestMembership({
          clubId: selectedClubId || undefined,
          clubName: trimmedClub,
          position: form.position || undefined,
          jerseyNumber: form.jerseyNumber || undefined,
        });
      } catch (err) {
          alert('Kërkesa për klubin dështoi. Kontrollo emrin e klubit.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label htmlFor="athlete-profile-photo" className="block text-sm font-medium mb-1">Profile Photo</label>
        {preview && (
          <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-2" />
        )}
        <input id="athlete-profile-photo" type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <h3 className="text-lg font-semibold mb-3">Athlete Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="athlete-first-name" className="block text-sm font-medium mb-1">First Name *</label>
          <input id="athlete-first-name" name="firstName" value={form.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor="athlete-last-name" className="block text-sm font-medium mb-1">Last Name *</label>
          <input id="athlete-last-name" name="lastName" value={form.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required autoComplete="family-name" />
        </div>
        <div>
          <label htmlFor="athlete-dob" className="block text-sm font-medium mb-1">Date of Birth</label>
          <input id="athlete-dob" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" autoComplete="bday" />
        </div>
        <div>
          <label htmlFor="athlete-gender" className="block text-sm font-medium mb-1">Gender</label>
          <select id="athlete-gender" name="gender" value={form.gender} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="athlete-bio" className="block text-sm font-medium mb-1">Bio</label>
        <textarea id="athlete-bio" name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={500} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="athlete-position" className="block text-sm font-medium mb-1">Position</label>
          <select id="athlete-position" name="position" value={form.position} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
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
          <label htmlFor="athlete-club" className="block text-sm font-medium mb-1">Club</label>
          <div className="relative">
            <input
              id="athlete-club"
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
              autoComplete="organization"
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
                        if (club.profilePhoto) {
                          setForm((prev) => ({ ...prev, clubLogo: club.profilePhoto }));
                        }
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
          <label htmlFor="athlete-jersey" className="block text-sm font-medium mb-1">Jersey Number</label>
          <input id="athlete-jersey" name="jerseyNumber" value={form.jerseyNumber} onChange={handleChange} type="number" min="1" max="99" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-city" className="block text-sm font-medium mb-1">City</label>
          <input id="athlete-city" name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-country" className="block text-sm font-medium mb-1">Country</label>
          <input id="athlete-country" name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-foot" className="block text-sm font-medium mb-1">Preferred Foot</label>
          <select id="athlete-foot" name="preferredFoot" value={form.preferredFoot} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label htmlFor="athlete-height" className="block text-sm font-medium mb-1">Height (cm)</label>
          <input id="athlete-height" name="height" value={form.height} onChange={handleChange} type="number" placeholder="175" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-weight" className="block text-sm font-medium mb-1">Weight (kg)</label>
          <input id="athlete-weight" name="weight" value={form.weight} onChange={handleChange} type="number" placeholder="70" className="w-full p-2 border border-gray-300 rounded" />
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
