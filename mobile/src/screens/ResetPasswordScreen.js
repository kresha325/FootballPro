import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import { extractErrorMessage, resetPasswordRequest } from '../api/client';
import { passwordPolicyMessage } from '../utils/passwordPolicy';
import { useLocale } from '../context/LocaleContext';

export default function ResetPasswordScreen({ route, navigation }) {
  const { t } = useLocale();
  const token = route?.params?.token || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!token) {
      setError(t('Linku i rivendosjes është i pavlefshëm ose mungon.'));
      return;
    }
    const passwordError = passwordPolicyMessage(password);
    if (passwordError) {
      setError(t(passwordError));
      return;
    }
    if (password !== confirm) {
      setError(t('Fjalëkalimet nuk përputhen.'));
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordRequest(token, password);
      Alert.alert(t('Sukses'), res?.data?.msg || t('Fjalëkalimi u përditësua. Tani mund të hyni.'), [
        { text: t('OK'), onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, t('Nuk u arrit rivendosja e fjalëkalimit')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Rivendos fjalëkalimin')}</Text>
      <Text style={styles.sub}>{t('Shkruani një fjalëkalim të ri për llogarinë tuaj.')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={t('Fjalëkalimi i ri')}
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t('Konfirmo fjalëkalimin')}
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('Përditëso fjalëkalimin')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>{t('Kthehu te hyrja')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  sub: { color: '#475569', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  btn: {
    backgroundColor: '#9A6B12',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#9A6B12', textAlign: 'center', marginTop: 16, fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 10 },
});
