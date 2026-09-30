import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import AiGenerateBioButton from './ai/AiGenerateBioButton';
import { safeNextPath } from '../utils/safeNextPath';

const ONBOARDING_KEY = 'fp_pending_onboarding';
const POST_AUTH_NEXT_KEY = 'xtalenti_post_auth_next';

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
      let storedNext = null;
      try {
        storedNext = sessionStorage.getItem(POST_AUTH_NEXT_KEY);
        sessionStorage.removeItem(POST_AUTH_NEXT_KEY);
      } catch {
        /* ignore */
      }
      if (storedNext) {
        navigate(safeNextPath(storedNext, goProfile ? '/profile' : '/feed'));
        return;
      }
      navigate(goProfile ? '/profile' : '/feed');
    } catch (err) {
      setError(err?.response?.data?.msg || 'Nuk u ruajt profili');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-[var(--xt-color-border-strong)] bg-[var(--xt-color-surface)] text-[var(--xt-color-text)] placeholder:text-[var(--xt-color-text-subtle)]';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--xt-color-canvas)] px-4 py-12 text-[var(--xt-color-text)]">
      <div className="xt-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex gap-2">
          <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-[var(--xt-color-gold)]' : 'bg-[var(--xt-color-border)]'}`} />
          <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-[var(--xt-color-gold)]' : 'bg-[var(--xt-color-border)]'}`} />
        </div>

        {step === 1 ? (
          <>
            <h1 className="mb-2 text-2xl font-bold text-[var(--xt-color-text)]">Ku je aktiv?</h1>
            <p className="mb-6 text-sm text-[var(--xt-color-text-muted)]">
              Qyteti dhe shteti ndihmojnë skautët dhe klubet të të gjejnë.
            </p>
            <input
              type="text"
              placeholder="Qyteti"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`${inputClass} mb-3`}
            />
            <p className="mb-2 text-sm font-semibold text-[var(--xt-color-text)]">Shteti</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    country === c
                      ? 'border-[var(--xt-color-gold)] bg-[var(--xt-color-gold)] text-[#101114]'
                      : 'border-[var(--xt-color-border-strong)] bg-[var(--xt-color-surface-raised)] text-[var(--xt-color-text)]'
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
              className={`${inputClass} mb-6`}
            />
            <button type="button" onClick={() => setStep(2)} className="btn btn-primary w-full">
              Vazhdo
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold text-[var(--xt-color-text)]">Prezantimi yt</h1>
            <p className="mb-4 text-sm text-[var(--xt-color-text-muted)]">Mund ta ndryshosh më vonë te profili.</p>
            <div className="mb-2 flex justify-end">
              <AiGenerateBioButton
                hints={{ city, country, extra: 'Regjistrim i ri në X TALENTI' }}
                onBio={setBio}
              />
            </div>
            <textarea
              rows={4}
              placeholder="Bio (opsionale)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              className={`${inputClass} mb-4`}
            />
            {error ? (
              <p className="mb-3 text-sm font-semibold text-[var(--xt-color-danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => finish(true)}
              className="btn btn-primary mb-2 w-full"
            >
              {saving ? 'Duke ruajtur…' : 'Shiko profilin'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => finish(false)}
              className="btn btn-quiet w-full"
            >
              Hyr në feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
