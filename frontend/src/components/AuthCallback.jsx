import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setOnboardingPending } from './RegisterOnboarding';

/**
 * OAuth redirect target: /auth/callback?token=...
 * Backend (Google/Facebook/Apple) sends users here after successful login.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    localStorage.setItem('token', token);

    let cancelled = false;
    (async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://footballpro.onrender.com/api';
        const res = await fetch(`${API_URL}/profiles/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 404) {
          setOnboardingPending();
          window.location.replace('/onboarding');
          return;
        }
        // Empty-ish profile (OAuth just created shell) → gentle onboarding once
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const thin =
            data &&
            !String(data.bio || '').trim() &&
            !String(data.city || '').trim() &&
            !String(data.country || '').trim() &&
            !localStorage.getItem('fp_oauth_onboarded');
          if (thin) {
            setOnboardingPending();
            localStorage.setItem('fp_oauth_onboarded', '1');
            window.location.replace('/onboarding');
            return;
          }
        }
      } catch {
        /* ignore — still enter app */
      }
      if (!cancelled) window.location.replace('/feed');
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-gray-600 dark:text-gray-300">Duke u kyçur…</p>
    </div>
  );
}
