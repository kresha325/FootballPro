import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BACKEND_URL } from '../config/api';

function resolveApiOrigin() {
  const fromEnv = String(BACKEND_URL || '').replace(/\/$/, '');
  let host = '';
  try {
    host = window.location.hostname;
  } catch {
    host = '';
  }
  // On the SPA host, never call itself for the passport callback.
  if (host && /xtalenti\.com$/i.test(host)) {
    if (fromEnv && !/xtalenti\.com/i.test(fromEnv)) return fromEnv;
    return 'https://footballpro.onrender.com';
  }
  if (fromEnv) return fromEnv;
  return 'https://footballpro.onrender.com';
}

/**
 * Meta/Google redirect to SPA first (App Domains = xtalenti.com),
 * then we forward ?code=&state= to the API passport callback.
 */
export default function OAuthCodeRelay({ provider }) {
  const location = useLocation();

  useEffect(() => {
    const base = resolveApiOrigin();
    const path =
      provider === 'google' ? '/api/auth/google/callback' : '/api/auth/facebook/callback';
    const qs = location.search || '';
    if (!qs) {
      window.location.replace('/login?error=oauth_failed');
      return;
    }
    window.location.replace(`${base}${path}${qs}`);
  }, [location.search, provider]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-gray-600 dark:text-gray-300">Duke përfunduar hyrjen…</p>
    </div>
  );
}
