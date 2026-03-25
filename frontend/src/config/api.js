// Automatic backend URL detection with safe fallbacks
const getBackendURL = () => {
  const hostname = window.location.hostname;

  // Explicit localtunnel override
  if (hostname.includes('loca.lt')) return 'https://tired-birds-rest.loca.lt';

  // Prefer explicit env var if provided
  const envUrl = import.meta?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.length) {
    return envUrl.replace(/\/api\/?$/i, '');
  }

  // Fallback to current origin (works in dev when VITE_API_URL not set)
  try {
    // If running on localhost during development, default to backend on :5000
    const origin = window.location.hostname;
    if (!envUrl && (origin === 'localhost' || origin === '127.0.0.1')) {
      return 'http://localhost:5000';
    }
    return window.location.origin.replace(/\/api\/?$/i, '');
  } catch (e) {
    // Last-resort empty string to avoid throwing errors in code that imports this file
    return '';
  }
};

export const BACKEND_URL = getBackendURL();
export const API_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

console.log('🔗 Backend URL:', BACKEND_URL);
