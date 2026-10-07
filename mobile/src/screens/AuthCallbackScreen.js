import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from '../theme/nativeComponents';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { exchangeOAuthCodeRequest, extractErrorMessage } from '../api/client';

/**
 * Deep link target: xtalenti://auth/callback?code=...
 * The code is exchanged once for the JWT. The JWT is not in the link.
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
      const code = params.code;
      if (error) {
        setMessage('Hyrja sociale dështoi. Provo përsëri.');
        setTimeout(() => navigation.replace('Login'), 1200);
        return;
      }
      if (!code) {
        setMessage('Kodi i hyrjes mungon.');
        setTimeout(() => navigation.replace('Login'), 1200);
        return;
      }
      let token = '';
      try {
        const exchanged = await exchangeOAuthCodeRequest(code);
        token = exchanged?.data?.token || '';
      } catch (err) {
        if (cancelled) return;
        setMessage(extractErrorMessage(err, 'Kodi i hyrjes është i pavlefshëm ose i skaduar'));
        setTimeout(() => navigation.replace('Login'), 1500);
        return;
      }
      if (cancelled) return;
      if (!token) {
        setMessage('Kodi i hyrjes është i pavlefshëm ose i skaduar');
        setTimeout(() => navigation.replace('Login'), 1500);
        return;
      }
      const result = await loginWithToken(token);
      if (cancelled) return;
      if (!result?.ok) {
        setMessage(result?.message || 'Hyrja dështoi.');
        setTimeout(() => navigation.replace('Login'), 1500);
      }
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
