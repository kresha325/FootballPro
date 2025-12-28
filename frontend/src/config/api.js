// Automatic backend URL detection
const getBackendURL = () => {
  // Check if running on mobile/network
  const hostname = window.location.hostname;
  
  // If accessing via localtunnel (loca.lt domain)
  if (hostname.includes('loca.lt')) {
    return 'https://tired-birds-rest.loca.lt';
  }
  
  // If accessing from network IP, use the same IP for backend
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:5098`;
  }
  
  // Default to localhost for local development
  return 'http://localhost:5098';
};

export const BACKEND_URL = getBackendURL();
export const API_URL = `${BACKEND_URL}/api`;

console.log('🔗 Backend URL:', BACKEND_URL);
