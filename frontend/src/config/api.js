// Automatic backend URL detection with safe fallbacks
const getBackendURL = () => {
  const envUrl = import.meta?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.length) {
    return envUrl.replace(/\/api\/?$/i, '');
  }

  const hostname = window.location.hostname;
  if (hostname.includes('loca.lt')) {
    const tunnel = import.meta?.env?.VITE_LOCAL_TUNNEL_BACKEND_URL;
    if (tunnel && typeof tunnel === 'string' && tunnel.trim().length) {
      return tunnel.replace(/\/api\/?$/i, '').replace(/\/$/, '');
    }
  }

  try {
    const origin = window.location.hostname;
    if (origin === 'localhost' || origin === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/\/api\/?$/i, '');
  } catch (e) {
    return '';
  }
};

export const BACKEND_URL = getBackendURL();
export const API_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

if (import.meta.env.DEV) {
  console.log('🔗 Backend URL:', BACKEND_URL);
}
