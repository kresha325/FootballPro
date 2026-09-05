import Constants from 'expo-constants';

const raw = Constants.expoConfig?.name || 'XTalenti';
export const APP_BRAND_NAME = raw.replace(/\s+Mobile\s*$/i, '').trim() || 'XTalenti';
