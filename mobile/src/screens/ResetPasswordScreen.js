import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, resetPasswordRequest } from '../api/client';

export default function ResetPasswordScreen({ route, navigation }) {
  const token = route?.params?.token || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!token) {
      setError('Linku i rivendosjes është i pavlefshëm ose mungon.');
      return;
    }
    if (password.length < 6) {
      setError('Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
      return;
    }
    if (password !== confirm) {
      setError('Fjalëkalimet nuk përputhen.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordRequest(token, password);
      Alert.alert('Sukses', res?.data?.msg || 'Fjalëkalimi u përditësua. Tani mund të hyni.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u arrit rivendosja e fjalëkalimit'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rivendos fjalëkalimin</Text>
      <Text style={styles.sub}>Shkruani një fjalëkalim të ri për llogarinë tuaj.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Fjalëkalimi i ri"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Konfirmo fjalëkalimin"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Përditëso fjalëkalimin</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Kthehu te hyrja</Text>
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
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#0f766e', textAlign: 'center', marginTop: 16, fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 10 },
});
