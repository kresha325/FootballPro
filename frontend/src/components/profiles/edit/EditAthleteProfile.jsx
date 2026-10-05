import React, { useEffect, useState } from 'react';
import { clubMembersAPI, profileAPI } from '../../../services/api';
import AiGenerateBioButton from '../../ai/AiGenerateBioButton';

const EditAthleteProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    bio: user.bio || '',
    position: user.position || '',
    club: user.club || '',
    clubJoinedYear: user.clubJoinedYear != null ? String(user.clubJoinedYear) : '',
    city: user.city || '',
    country: user.country || '',
    height: user.stats?.height || '',
    weight: user.stats?.weight || '',
    preferredFoot: user.stats?.preferredFoot || '',
    jerseyNumber: user.stats?.jerseyNumber || '',
    secondaryPositions: Array.isArray(user.stats?.secondaryPositions) ? user.stats.secondaryPositions.join(', ') : '',
    preferredLanguage: user.stats?.preferredLanguage || '',
    playingLevel: user.stats?.playingLevel || '',
    footballCategory: user.stats?.footballCategory || '',
    youthSenior: user.stats?.youthSenior || '',
    currentTeam: user.stats?.currentTeam || '',
    footballJourney: user.stats?.footballJourney || '',
    strengths: user.stats?.strengths || '',
    playingStyle: user.stats?.playingStyle || '',
    objectives: user.stats?.objectives || '',
    agentName: user.stats?.agentName || '',
    agencyName: user.stats?.agencyName || '',
    contactEmail: user.contact?.email || '',
    contactPhone: user.contact?.phone || '',
    privacyDateOfBirth: user.privacy?.dateOfBirth || 'public',
    privacyContact: user.privacy?.contact || 'public',
    privacyAgent: user.privacy?.agent || 'followers',
    privacyLocation: user.privacy?.location || 'public',
    privacyEmail: user.privacy?.email || 'private',
    privacyPhone: user.privacy?.phone || 'private',
    privacyVideos: user.privacy?.videos || 'public',
    privacyGallery: user.privacy?.gallery || 'public',
    privacyCareer: user.privacy?.career || 'public',
    achievementTitle: '',
    achievementSeason: '',
    achievementCompetition: '',
    achievementClub: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto || '');
  const [clubSuggestions, setClubSuggestions] = useState([]);
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [clubQuery, setClubQuery] = useState(user.club || '');
  const [selectedClubId, setSelectedClubId] = useState(
    user.clubId != null ? Number(user.clubId) : null
  );
  const [formError, setFormError] = useState('');

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
    setFormError('');
    const trimmedClub = form.club?.trim();
    const yearRaw = String(form.clubJoinedYear || '').trim();
    if (trimmedClub && !yearRaw) {
      setFormError('Vendos vitin nga kur je në këtë klub.');
      return;
    }
    if (yearRaw) {
      const yearNum = parseInt(yearRaw, 10);
      const maxYear = new Date().getFullYear() + 1;
      if (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > maxYear) {
        setFormError('Viti i klubit nuk është i vlefshëm.');
        return;
      }
    }
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
    if (trimmedClub && yearRaw) {
      formData.append('clubJoinedYear', yearRaw);
    } else if (!trimmedClub) {
      formData.append('clubJoinedYear', '');
    }
    // Paketoj fushat e statistikave si objekt stats
    const stats = {
      height: form.height,
      weight: form.weight,
      preferredFoot: form.preferredFoot,
      jerseyNumber: form.jerseyNumber,
      secondaryPositions: form.secondaryPositions,
      preferredLanguage: form.preferredLanguage,
      playingLevel: form.playingLevel,
      footballCategory: form.footballCategory,
      youthSenior: form.youthSenior,
      currentTeam: form.currentTeam,
      footballJourney: form.footballJourney,
      strengths: form.strengths,
      playingStyle: form.playingStyle,
      objectives: form.objectives,
      agentName: form.agentName,
      agencyName: form.agencyName,
    };
    formData.append('stats', JSON.stringify(stats));
    formData.append('contact', JSON.stringify({
      ...(user.contact && typeof user.contact === 'object' ? user.contact : {}),
      email: form.contactEmail,
      phone: form.contactPhone,
    }));
    formData.append('privacy', JSON.stringify({
      dateOfBirth: form.privacyDateOfBirth,
      contact: form.privacyContact,
      agent: form.privacyAgent,
      location: form.privacyLocation,
      email: form.privacyEmail,
      phone: form.privacyPhone,
      videos: form.privacyVideos,
      gallery: form.privacyGallery,
      career: form.privacyCareer,
    }));
    const existingAchievements = Array.isArray(user.achievements) ? user.achievements.filter((item) => item && !item.source) : [];
    if (form.achievementTitle.trim()) {
      existingAchievements.push({
        title: form.achievementTitle.trim(),
        season: form.achievementSeason,
        competition: form.achievementCompetition,
        club: form.achievementClub,
      });
    }
    formData.append('achievements', JSON.stringify(existingAchievements));
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    await onSave(formData);

    if (trimmedClub) {
      try {
        // Kërkesë membership (ruan në ClubMembers)
        await clubMembersAPI.requestMembership({
          clubId: selectedClubId || undefined,
          clubName: trimmedClub,
          position: form.position || undefined,
          jerseyNumber: form.jerseyNumber || undefined,
        });
        // Kërkesë roster (aktivizon notification për klubin)
        await import('../../../services/api').then(({ API }) =>
          API.post('/club-roster/request', {
            clubId: selectedClubId || undefined,
            position: form.position || undefined,
            jerseyNumber: form.jerseyNumber || undefined,
          })
        );
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
        <input id="athlete-profile-photo" type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} autoComplete="photo" />
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
        <div className="flex items-center justify-between gap-2 mb-1">
          <label htmlFor="athlete-bio" className="block text-sm font-medium">Bio</label>
          <AiGenerateBioButton
            hints={{
              position: form.position,
              club: form.club,
              city: form.city,
              country: form.country,
            }}
            onBio={(bio) => setForm((prev) => ({ ...prev, bio }))}
          />
        </div>
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
          <label htmlFor="athlete-club" className="block text-sm font-medium mb-1">Klubi</label>
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
          <label htmlFor="athlete-club-year" className="block text-sm font-medium mb-1">Nga viti (klubi aktual)</label>
          <input
            id="athlete-club-year"
            name="clubJoinedYear"
            value={form.clubJoinedYear}
            onChange={handleChange}
            type="number"
            min="1950"
            max={new Date().getFullYear() + 1}
            placeholder="p.sh. 2024"
            className="w-full p-2 border border-gray-300 rounded"
            autoComplete="off"
            required={Boolean(form.club?.trim())}
          />
          <p className="mt-1 text-xs text-gray-500">
            Ky vit shfaqet te Karriera si «nga YYYY · vazhdon». Ndryshoje këtu dhe Ruaj.
          </p>
        </div>
        <div>
          <label htmlFor="athlete-jersey" className="block text-sm font-medium mb-1">Jersey Number</label>
          <input id="athlete-jersey" name="jerseyNumber" value={form.jerseyNumber} onChange={handleChange} type="number" min="1" max="99" className="w-full p-2 border border-gray-300 rounded" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="athlete-city" className="block text-sm font-medium mb-1">City</label>
          <input id="athlete-city" name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" autoComplete="address-level2" />
        </div>
        <div>
          <label htmlFor="athlete-country" className="block text-sm font-medium mb-1">Country</label>
          <input id="athlete-country" name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" autoComplete="country" />
        </div>
        <div>
          <label htmlFor="athlete-foot" className="block text-sm font-medium mb-1">Preferred Foot</label>
          <select id="athlete-foot" name="preferredFoot" value={form.preferredFoot} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select foot</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label htmlFor="athlete-height" className="block text-sm font-medium mb-1">Height (cm)</label>
          <input id="athlete-height" name="height" value={form.height} onChange={handleChange} type="number" placeholder="175" className="w-full p-2 border border-gray-300 rounded" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="athlete-weight" className="block text-sm font-medium mb-1">Weight (kg)</label>
          <input id="athlete-weight" name="weight" value={form.weight} onChange={handleChange} type="number" placeholder="70" className="w-full p-2 border border-gray-300 rounded" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="athlete-secondary" className="block text-sm font-medium mb-1">Secondary positions</label>
          <input id="athlete-secondary" name="secondaryPositions" value={form.secondaryPositions} onChange={handleChange} placeholder="Winger, Striker" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-language" className="block text-sm font-medium mb-1">Preferred language</label>
          <input id="athlete-language" name="preferredLanguage" value={form.preferredLanguage} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-level" className="block text-sm font-medium mb-1">Playing level</label>
          <input id="athlete-level" name="playingLevel" value={form.playingLevel} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-category" className="block text-sm font-medium mb-1">Football category</label>
          <input id="athlete-category" name="footballCategory" value={form.footballCategory} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-status" className="block text-sm font-medium mb-1">Youth / senior</label>
          <select id="athlete-status" name="youthSenior" value={form.youthSenior} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
            <option value="">Select</option>
            <option value="youth">Youth</option>
            <option value="senior">Senior</option>
          </select>
        </div>
        <div>
          <label htmlFor="athlete-journey" className="block text-sm font-medium mb-1">Football journey</label>
          <textarea id="athlete-journey" name="footballJourney" value={form.footballJourney} onChange={handleChange} rows={3} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-strengths" className="block text-sm font-medium mb-1">Strengths</label>
          <textarea id="athlete-strengths" name="strengths" value={form.strengths} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-style" className="block text-sm font-medium mb-1">Playing style</label>
          <textarea id="athlete-style" name="playingStyle" value={form.playingStyle} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-objectives" className="block text-sm font-medium mb-1">Objectives</label>
          <textarea id="athlete-objectives" name="objectives" value={form.objectives} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-agent" className="block text-sm font-medium mb-1">Agent</label>
          <input id="athlete-agent" name="agentName" value={form.agentName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-agency" className="block text-sm font-medium mb-1">Agency</label>
          <input id="athlete-agency" name="agencyName" value={form.agencyName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-contact-email" className="block text-sm font-medium mb-1">Contact email</label>
          <input id="athlete-contact-email" name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-contact-phone" className="block text-sm font-medium mb-1">Phone</label>
          <input id="athlete-contact-phone" name="contactPhone" value={form.contactPhone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label htmlFor="athlete-award" className="block text-sm font-medium mb-1">Add achievement</label>
          <input id="athlete-award" name="achievementTitle" value={form.achievementTitle} onChange={handleChange} placeholder="Title" className="mb-2 w-full p-2 border border-gray-300 rounded" />
          <input name="achievementSeason" value={form.achievementSeason} onChange={handleChange} placeholder="Season" className="mb-2 w-full p-2 border border-gray-300 rounded" />
          <input name="achievementCompetition" value={form.achievementCompetition} onChange={handleChange} placeholder="Competition" className="mb-2 w-full p-2 border border-gray-300 rounded" />
          <input name="achievementClub" value={form.achievementClub} onChange={handleChange} placeholder="Club" className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['privacyDateOfBirth', 'Date of birth'],
          ['privacyLocation', 'Location'],
          ['privacyCareer', 'Career'],
          ['privacyContact', 'Contact'],
          ['privacyEmail', 'Email'],
          ['privacyPhone', 'Phone'],
          ['privacyAgent', 'Agent'],
          ['privacyGallery', 'Gallery'],
          ['privacyVideos', 'Videos'],
        ].map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>
            <select id={name} name={name} value={form[name]} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded">
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {(formError || (errors && errors.general)) && (
        <div className="text-red-500 mt-2">{formError || errors.general}</div>
      )}
    </form>
  );
};

export default EditAthleteProfile;
