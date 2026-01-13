import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { profileAPI, clubMembersAPI, ligaAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EditAthleteProfile from './profiles/edit/EditAthleteProfile';
import EditCoachProfile from './profiles/edit/EditCoachProfile';
import EditLigaProfile from './profiles/edit/EditLigaProfile';
import EditFederationProfile from './profiles/edit/EditFederationProfile';
import EditClubProfile from './profiles/edit/EditClubProfile';
import EditBusinessProfile from './profiles/edit/EditBusinessProfile';
import EditManagerProfile from './profiles/edit/EditManagerProfile';
import EditScoutProfile from './profiles/edit/EditScoutProfile';

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

  // Role-based save handler
  const handleSave = async (form) => {
    setLoading(true);
    try {
      let api;
      switch (user.role) {
        case 'athlete':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'coach':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'liga':
          api = ligaAPI;
          await api.updateLiga(form);
          break;
        case 'federation':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'club':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'business':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'manager':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        case 'scout':
          api = profileAPI;
          await api.updateProfile(form);
          break;
        default:
          api = profileAPI;
          await api.updateProfile(form);
      }
      window.location.reload();
    } catch (err) {
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
          {user.role === 'athlete' && (
            <EditAthleteProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'coach' && (
            <EditCoachProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'liga' && (
            <EditLigaProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'federation' && (
            <EditFederationProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'club' && (
            <EditClubProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'business' && (
            <EditBusinessProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'manager' && (
            <EditManagerProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
          )}
          {user.role === 'scout' && (
            <EditScoutProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
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
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
