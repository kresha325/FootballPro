import Constants from 'expo-constants';

const fromExpoConfig = Constants.expoConfig?.extra?.BACKEND_URL;
const fromManifest = Constants.manifest?.extra?.BACKEND_URL;

export const BACKEND_URL = (fromExpoConfig || fromManifest || 'https://footballpro.onrender.com').replace(/\/$/, '');

/** URL e frontend-it (Vite) për WebView thirrjeje — /embed-call. Zbrazët nëse nuk është konfiguruar. */
const webFromExpo = Constants.expoConfig?.extra?.WEB_APP_URL;
const webFromManifest = Constants.manifest?.extra?.WEB_APP_URL;
export const WEB_APP_URL = String(webFromExpo || webFromManifest || '').replace(/\/$/, '');
