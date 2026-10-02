import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BACKEND_URL } from '../config/api';

/**
 * Meta/Google redirect to SPA first (App Domains = xtalenti.com),
 * then we forward ?code=&state= to the API passport callback.
 *
 * Routes:
 *   /auth/facebook/callback → /api/auth/facebook/callback
 *   /auth/google/callback   → /api/auth/google/callback
 */
export default function OAuthCodeRelay({ provider }) {
  const location = useLocation();

  useEffect(() => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
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
