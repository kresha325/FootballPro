import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from '../theme/nativeComponents';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/**
 * Deep link target: xtalenti://auth/callback?token=...
 * Backend OAuth redirects here when started with ?app=1.
 */
export default function AuthCallbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { loginWithToken } = useAuth();
  const [message, setMessage] = useState('Duke u kyçur…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = route.params || {};
      const error = params.error;
      const token = params.token;
      if (error) {
        setMessage('Hyrja sociale dështoi. Provo përsëri.');
        setTimeout(() => navigation.replace('Login'), 1200);
        return;
      }
      if (!token) {
        setMessage('Token mungon.');
        setTimeout(() => navigation.replace('Login'), 1200);
        return;
      }
      const result = await loginWithToken(token);
      if (cancelled) return;
      if (!result?.ok) {
        setMessage(result?.message || 'Hyrja dështoi.');
        setTimeout(() => navigation.replace('Login'), 1500);
        return;
      }
      // Auth gate in navigator will switch to Main when token is set.
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params, loginWithToken, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.msg, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { marginTop: 14, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
