import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import AiGenerateBioButton from './ai/AiGenerateBioButton';

const ONBOARDING_KEY = 'fp_pending_onboarding';

export function isOnboardingPending() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function clearOnboardingPending() {
  localStorage.removeItem(ONBOARDING_KEY);
}

export function setOnboardingPending() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

const COUNTRIES = ['Kosovë', 'Shqipëri', 'Maqedoni e Veriut', 'Zvicër', 'Gjermani', 'Tjetër'];

export default function RegisterOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finish = async (goProfile) => {
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      if (city.trim()) form.append('city', city.trim());
      if (country.trim()) form.append('country', country.trim());
      if (bio.trim()) form.append('bio', bio.trim());
      if (city.trim() || country.trim() || bio.trim()) {
        await profileAPI.updateProfile(form);
      }
      clearOnboardingPending();
      const needsParent = localStorage.getItem('fp_requires_parent') === '1';
      localStorage.removeItem('fp_requires_parent');
      if (needsParent) {
        navigate('/parent-verification');
        return;
      }
      navigate(goProfile ? '/profile' : '/feed');
    } catch (err) {
      setError(err?.response?.data?.msg || 'Nuk u ruajt profili');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-teal-600' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-teal-600' : 'bg-gray-200'}`} />
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ku je aktiv?</h1>
            <p className="text-sm text-gray-600 mb-6">Qyteti dhe shteti ndihmojnë skautët dhe klubet të të gjejnë.</p>
            <input
              type="text"
              placeholder="Qyteti"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full mb-3 px-3 py-2 border rounded-md"
            />
            <p className="text-sm font-medium text-gray-700 mb-2">Shteti</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {COUNTRIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    country === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ose shkruaj shtetin"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full mb-6 px-3 py-2 border rounded-md"
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-2 bg-teal-600 text-white font-semibold rounded-md"
            >
              Vazhdo
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Prezantimi yt</h1>
            <p className="text-sm text-gray-600 mb-4">Mund ta ndryshosh më vonë te profili.</p>
            <div className="flex justify-end mb-2">
              <AiGenerateBioButton
                hints={{ city, country, extra: 'Regjistrim i ri në FootballPro' }}
                onBio={setBio}
              />
            </div>
            <textarea
              rows={4}
              placeholder="Bio (opsionale)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              className="w-full mb-4 px-3 py-2 border rounded-md"
            />
            {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => finish(true)}
              className="w-full py-2 mb-2 bg-teal-600 text-white font-semibold rounded-md disabled:opacity-50"
            >
              {saving ? 'Duke ruajtur…' : 'Shiko profilin'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => finish(false)}
              className="w-full py-2 text-teal-700 font-medium"
            >
              Hyr në feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
