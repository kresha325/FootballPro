import Constants from 'expo-constants';

const fromExpoConfig = Constants.expoConfig?.extra?.BACKEND_URL;
const fromManifest = Constants.manifest?.extra?.BACKEND_URL;

export const BACKEND_URL = (fromExpoConfig || fromManifest || 'https://footballpro.onrender.com').replace(/\/$/, '');
