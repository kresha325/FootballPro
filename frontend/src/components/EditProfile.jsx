import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { profileAPI, clubMembersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EditProfile = ({ onClose }) => {
  const location = useLocation();
  const initialPath = useRef(location.pathname);

  // Close modal when location changes
  useEffect(() => {
    if (location.pathname !== initialPath.current) {
      onClose();
    }
  }, [location.pathname, onClose]);

  const { user } = useAuth();

  // Helper for ente roles
  const ENTE_ROLES = ['business', 'federation', 'media', 'club'];
  const isEnte = ENTE_ROLES.includes(user.role);

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
    phone: user.contact?.phone || '',
    instagram: user.contact?.instagram || '',
    twitter: user.contact?.twitter || '',
    facebook: user.contact?.facebook || '',
    height: user.stats?.height || '',
    weight: user.stats?.weight || '',
    preferredFoot: user.stats?.preferredFoot || 'right',
    jerseyNumber: user.stats?.jerseyNumber || '',
    coachAffiliation: user.coachAffiliation || '',
    coachCategory: user.coachCategory || '',

    // Ente/business fields
    industry: user.stats?.industry || '',
    founded: user.stats?.founded || '',
    companySize: user.stats?.companySize || '',
    revenue: user.stats?.revenue || '',
    employees: user.stats?.employees || '',
    partnerships: user.stats?.partnerships || '',
    countries: user.stats?.countries || '',
  });
  
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100000000) { // 100MB limit
        setErrors({ ...errors, [type]: 'File size must be less than 100MB' });
        return;
      }
      if (type === 'profilePhoto') setProfilePhoto(file);
      else setCoverPhoto(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (form.phone && !/^\+?[0-9\s-()]+$/.test(form.phone)) {
      newErrors.phone = 'Invalid phone number';
    }
    if (form.height && (isNaN(form.height) || form.height < 0)) {
      newErrors.height = 'Invalid height';
    }
    if (form.weight && (isNaN(form.weight) || form.weight < 0)) {
      newErrors.weight = 'Invalid weight';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      
      // Basic info
      formData.append('firstName', form.firstName);
      formData.append('lastName', form.lastName);
      if (form.dateOfBirth) {
        formData.append('dateOfBirth', form.dateOfBirth);
      }
      if (form.gender) {
        formData.append('gender', form.gender);
      }
      formData.append('bio', form.bio);
      formData.append('position', form.position);
      formData.append('club', form.club);
      formData.append('city', form.city);
      formData.append('country', form.country);
      
      // Coach specific fields
      if (user.role === 'coach') {
        if (form.coachAffiliation) {
          formData.append('coachAffiliation', form.coachAffiliation);
        }
        if (form.coachCategory) {
          formData.append('coachCategory', form.coachCategory);
        }
      }
      
      // Stats
      const stats = {
        height: form.height,
        weight: form.weight,
        preferredFoot: form.preferredFoot,
        jerseyNumber: form.jerseyNumber,

        // Ente/business fields
        industry: form.industry,
        founded: form.founded,
        companySize: form.companySize,
        revenue: form.revenue,
        employees: form.employees,
        partnerships: form.partnerships,
        countries: form.countries,
      };
      formData.append('stats', JSON.stringify(stats));
      
      // Contact
      const contact = {
        phone: form.phone,
        instagram: form.instagram,
        twitter: form.twitter,
        facebook: form.facebook,
      };
      formData.append('contact', JSON.stringify(contact));
      
      // Photos
      if (profilePhoto) formData.append('profilePhoto', profilePhoto);
      if (coverPhoto) formData.append('coverPhoto', coverPhoto);
      
      // Update profile (will create if doesn't exist)
      await profileAPI.updateProfile(formData);

      // If athlete and club changed, send membership request
      if (user.role === 'athlete' && form.club && form.club !== user.club) {
        try {
          await clubMembersAPI.requestMembership({
            clubName: form.club,
            position: form.position,
            jerseyNumber: form.jerseyNumber,
          });
          console.log('Club membership request sent');
        } catch (err) {
          console.error('Membership request error:', err);
          // Don't fail the whole save if this fails
        }
      }

      window.location.reload();
    } catch (err) {
      console.error('Save profile error:', err);
      setErrors({ general: err.response?.data?.msg || 'Error saving profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-full max-w-3xl my-8 mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Edit Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errors.general && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {errors.general}
          </div>
        )}

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {/* Profile & Cover Photos */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Photos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Profile Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'profilePhoto')}
                  className="w-full text-sm"
                />
                {errors.profilePhoto && <p className="text-red-500 text-xs mt-1">{errors.profilePhoto}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cover Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'coverPhoto')}
                  className="w-full text-sm"
                />
                {errors.coverPhoto && <p className="text-red-500 text-xs mt-1">{errors.coverPhoto}</p>}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="First name"
                  required
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Last name"
                  required
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  name="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  name="gender"
                  value={form.gender || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Bio</label>
            <textarea
              name="bio"
              value={form.bio}
                onChange={handleChange}
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">{form.bio.length}/500 characters</p>
            </div>

          {/* Football Info */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Football Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Position</label>
                <select
                  name="position"
                  value={form.position}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                >
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
                <input
                  name="club"
                  value={form.club}
                  onChange={handleChange}
                  placeholder="Current club"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jersey Number</label>
                <input
                  name="jerseyNumber"
                  value={form.jerseyNumber}
                  onChange={handleChange}
                  type="number"
                  min="1"
                  max="99"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Foot</label>
                <select
                  name="preferredFoot"
                  value={form.preferredFoot}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
          </div>

          {/* Coach Specific Fields */}
          {user.role === 'coach' && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Coach Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Affiliation</label>
                  <select
                    name="coachAffiliation"
                    value={form.coachAffiliation || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="">Select Affiliation</option>
                    <option value="club">Club Trainer</option>
                    <option value="independent">Independent</option>
                    <option value="personal_trainer">Personal Trainer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    name="coachCategory"
                    value={form.coachCategory || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
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
              </div>
            </div>
          )}

          {/* Physical Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Physical Stats</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Height (cm)</label>
                <input
                  name="height"
                  value={form.height}
                  onChange={handleChange}
                  type="number"
                  placeholder="175"
                  className={`w-full p-2 border rounded ${errors.height ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.height && <p className="text-red-500 text-xs mt-1">{errors.height}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                <input
                  name="weight"
                  value={form.weight}
                  onChange={handleChange}
                  type="number"
                  placeholder="70"
                  className={`w-full p-2 border rounded ${errors.weight ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight}</p>}
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Prishtina"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Kosovo"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Contact & Social */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Contact & Social Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  type="tel"
                  placeholder="+383 XX XXX XXX"
                  className={`w-full p-2 border rounded ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Instagram</label>
                <input
                  name="instagram"
                  value={form.instagram}
                  onChange={handleChange}
                  placeholder="@username"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Twitter</label>
                <input
                  name="twitter"
                  value={form.twitter}
                  onChange={handleChange}
                  placeholder="@username"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Facebook</label>
                <input
                  name="facebook"
                  value={form.facebook}
                  onChange={handleChange}
                  placeholder="facebook.com/username"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Business/Ente Information */}
          {isEnte && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Business/Organization Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Industry</label>
                  <input
                    name="industry"
                    value={form.industry}
                    onChange={handleChange}
                    placeholder="Industry"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Founded</label>
                  <input
                    name="founded"
                    value={form.founded}
                    onChange={handleChange}
                    placeholder="Year founded"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Company Size</label>
                  <input
                    name="companySize"
                    value={form.companySize}
                    onChange={handleChange}
                    placeholder="Company size"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics for ente */}
          {isEnte && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Key Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Revenue</label>
                  <input
                    name="revenue"
                    value={form.revenue}
                    onChange={handleChange}
                    placeholder="Annual revenue"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Employees</label>
                  <input
                    name="employees"
                    value={form.employees}
                    onChange={handleChange}
                    placeholder="Number of employees"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Partnerships</label>
                  <input
                    name="partnerships"
                    value={form.partnerships}
                    onChange={handleChange}
                    placeholder="Number of partnerships"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Countries</label>
                  <input
                    name="countries"
                    value={form.countries}
                    onChange={handleChange}
                    placeholder="Countries present in"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={saveProfile}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
