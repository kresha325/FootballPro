import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, DeviceEventEmitter, StyleSheet, Text, View } from 'react-native';
import { publicConfigRequest } from '../api/client';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useLocale } from './LocaleContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PlatformContext = createContext({ features: null, maintenance: null, isEnabled: () => true });

export function PlatformProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState({ features: null, maintenance: null });

  const refresh = useCallback(async () => {
    try {
      const response = await publicConfigRequest();
      setData({ features: response.data?.features || {}, maintenance: response.data?.maintenance || null });
    } catch {
      // Match web behavior: keep features available if the public config cannot be reached.
      setData((current) => ({ ...current, features: current.features || {} }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const maintenanceSubscription = DeviceEventEmitter.addListener('xt-maintenance', (maintenance) => {
      setData((current) => ({ ...current, maintenance }));
    });
    return () => {
      subscription.remove();
      maintenanceSubscription.remove();
    };
  }, [refresh]);

  const isEnabled = useCallback((flag) => user?.role === 'admin' || !data.features || data.features[flag] !== false, [data.features, user?.role]);
  const value = useMemo(() => ({ ...data, isEnabled, refresh }), [data, isEnabled, refresh]);
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  return useContext(PlatformContext);
}

export function FeatureUnavailable({ flag }) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const names = {
    MARKETPLACE: t('Marketplace'),
    SCOUTING: t('Scouting'),
    LIVE_STREAMING: t('Live streaming'),
    ANALYTICS: t('Analytics'),
    PREMIUM: t('Premium'),
    JONCOIN: t('Wallet'),
  };
  return (
    <View style={[styles.unavailable, { backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('This feature is currently unavailable.')}</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{t('An administrator has temporarily disabled this feature.')}</Text>
      {names[flag] ? <Text style={[styles.featureName, { color: colors.muted }]}>{names[flag]}</Text> : null}
    </View>
  );
}

export function MaintenanceBanner() {
  const { maintenance } = usePlatform();
  const { user } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  if (!maintenance?.enabled || user?.role === 'admin') return null;
  return (
    <View style={[styles.maintenance, { paddingTop: Math.max(10, insets.top + 6) }]}>
      <Text style={styles.maintenanceText}>
        {maintenance.message || t('The platform is under maintenance.')}
        {maintenance.estimatedMinutes ? ` ${t('Estimated')}: ${maintenance.estimatedMinutes} ${t('minutes')}.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  message: { marginTop: 8, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  featureName: { marginTop: 10, fontSize: 13 },
  maintenance: { backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FCD34D', paddingHorizontal: 16, paddingVertical: 10 },
  maintenanceText: { color: '#78350F', textAlign: 'center', fontSize: 13, fontWeight: '600' },
});
