import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { profileAPI, clubMembersAPI, ligaAPI } from '../services/api';
import EditAthleteProfile from './profiles/edit/EditAthleteProfile';
import EditCoachProfile from './profiles/edit/EditCoachProfile';
import EditLigaProfile from './profiles/edit/EditLigaProfile';
import EditFederationProfile from './profiles/edit/EditFederationProfile';
import EditClubProfile from './profiles/edit/EditClubProfile';
import EditBusinessProfile from './profiles/edit/EditBusinessProfile';
import EditManagerProfile from './profiles/edit/EditManagerProfile';
import EditRefereeProfile from './profiles/edit/EditRefereeProfile';
import EditScoutProfile from './profiles/edit/EditScoutProfile';

const EditProfile = ({ user, onClose }) => {
  const location = useLocation();
  const initialPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== initialPath.current) {
      onClose();
    }
  }, [location.pathname, onClose]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSave = async (form) => {
    setLoading(true);
    try {
      if (user.role === 'liga') {
        await ligaAPI.updateLiga(form);
      } else {
        await profileAPI.updateProfile(form);
        if (user.role === 'athlete') {
          const oldClubId = user.clubId || user.club || '';
          const newClubId = form.get('clubId') || form.get('club') || '';
          if (newClubId && newClubId !== oldClubId) {
            try {
              await clubMembersAPI.requestMembership({
                clubId: form.get('clubId') || undefined,
                clubName: form.get('club') || undefined,
                position: form.get('position') || undefined,
                jerseyNumber: JSON.parse(form.get('stats') || '{}').jerseyNumber || undefined,
              });
            } catch {
              /* membership request may fail if already pending */
            }
          }
        }
      }
      setLoading(false);
      onClose();
    } catch {
      setLoading(false);
      setErrors({ general: 'Gabim gjatë ruajtjes së profilit.' });
    }
  };

  return (
    <div>
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
        {user.role === 'media' && (
          <EditBusinessProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
        )}
        {user.role === 'manager' && (
          <EditManagerProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
        )}
        {user.role === 'referee' && (
          <EditRefereeProfile user={user} onSave={handleSave} loading={loading} errors={errors} />
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
  );
};

export default EditProfile;
