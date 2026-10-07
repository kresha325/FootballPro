import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setOnboardingPending } from './RegisterOnboarding';
import { authAPI } from '../services/api';

/**
 * OAuth redirect target: /auth/callback?code=...
 * The code is single-use and exchanged for the JWT via POST.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      navigate('/login', { replace: true });
      return;
    }
    window.history.replaceState({}, '', '/auth/callback');

    let cancelled = false;
    (async () => {
      let token = '';
      try {
        const exchanged = await authAPI.exchangeOAuthCode(code);
        token = exchanged?.data?.token || '';
      } catch {
        token = '';
      }
      if (cancelled) return;
      if (!token) {
        navigate('/login?error=oauth_failed', { replace: true });
        return;
      }
      localStorage.setItem('token', token);

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
