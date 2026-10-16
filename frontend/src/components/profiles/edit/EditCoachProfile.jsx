import React, { useEffect, useState } from 'react';
import AiGenerateBioButton from '../../ai/AiGenerateBioButton';
import { profileAPI } from '../../../services/api';
import { getFullUrl } from '../../../utils/mediaUrl';
import { useLocale } from '../../../contexts/LocaleContext';

const EditCoachProfile = ({ user, onSave, loading, errors }) => {
  const { t } = useLocale();
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    bio: user.bio || '',
    club: user.club || '',
    clubLogo: user.clubLogo || '',
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
  const [preview, setPreview] = useState(user.profilePhoto ? getFullUrl(user.profilePhoto) : '');
  const [clubSuggestions, setClubSuggestions] = useState([]);
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [clubQuery, setClubQuery] = useState(user.club || '');
  const [selectedClubId, setSelectedClubId] = useState(user.clubId || null);

  useEffect(() => {
    setPreview(user.profilePhoto ? getFullUrl(user.profilePhoto) : '');
  }, [user.profilePhoto]);

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
    // Submit an empty value when free-text changes so the backend can clear a stale club link.
    formData.append('clubId', selectedClubId || '');
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{t('Profile Photo')}</label>
        {preview && (
          <img src={preview} alt={t('Preview')} className="w-24 h-24 rounded-full object-cover mb-2" />
        )}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <h3 className="text-lg font-semibold mb-3">{t('Coach Profile')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('First Name')} *</label>
          <input id="coach-first-name" name="firstName" value={form.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required autoComplete="given-name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Last Name')} *</label>
          <input id="coach-last-name" name="lastName" value={form.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required autoComplete="family-name" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium">{t('Bio')}</label>
          <AiGenerateBioButton
            hints={{ club: form.club, city: form.city, country: form.country }}
            onBio={(bio) => setForm((prev) => ({ ...prev, bio }))}
          />
        </div>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={500} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('Club')}</label>
          <div className="relative">
            <input
              id="coach-club"
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
              placeholder={t('Shkruaj emrin e klubit')}
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
                        setForm((prev) => ({
                          ...prev,
                          club: label,
                          ...(club.profilePhoto ? { clubLogo: club.profilePhoto } : {}),
                        }));
                        setClubQuery(label);
                        setSelectedClubId(club.userId || club.id);
                        setShowClubSuggestions(false);
                      }}
                    >
                      {label || t('Club')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Affiliation')}</label>
          <select name="coachAffiliation" value={form.coachAffiliation} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">{t('Select Affiliation')}</option>
            <option value="club">{t('Club Trainer')}</option>
            <option value="independent">{t('Independent')}</option>
            <option value="personal_trainer">{t('Personal Trainer')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Category')}</label>
          <select name="coachCategory" value={form.coachCategory} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">{t('Select Category')}</option>
            <option value="general_trainer">{t('General Trainer')}</option>
            <option value="assistant_trainer">{t('Assistant Trainer')}</option>
            <option value="fitness_trainer">{t('Fitness/Conditional Trainer')}</option>
            <option value="goalkeeper_trainer">{t('Goalkeeper Trainer')}</option>
            <option value="technical_trainer">{t('Technical Trainer')}</option>
            <option value="tactical_trainer">{t('Tactical Trainer')}</option>
            <option value="psychological_trainer">{t('Psychological Trainer')}</option>
            <option value="youth_trainer">{t('Youth Trainer')}</option>
            <option value="rehabilitation_trainer">{t('Rehabilitation Trainer')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('City')}</label>
          <input name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Country')}</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Career History')}</label>
          <textarea name="careerHistory" value={form.careerHistory} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? t('Saving...') : t('Save Changes')}
        </button>
      </div>
      {errors && errors.general && <div className="text-red-500 mt-2">{errors.general}</div>}
    </form>
  );
};

export default EditCoachProfile;
