import Constants from 'expo-constants';

const raw = Constants.expoConfig?.name || 'FootballPro';
export const APP_BRAND_NAME = raw.replace(/\s+Mobile\s*$/i, '').trim() || 'FootballPro';
