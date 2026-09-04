import Constants from 'expo-constants';

const raw = Constants.expoConfig?.name || 'X Talenti';
export const APP_BRAND_NAME = raw.replace(/\s+Mobile\s*$/i, '').trim() || 'X Talenti';
