import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, parentVerificationRequest } from '../api/client';

export default function ParentVerificationScreen({ navigation }) {
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid parent email.');
      return;
    }

    setLoading(true);
    try {
      const res = await parentVerificationRequest(parentEmail);
      if (res?.data?.success) {
        Alert.alert('Sent', 'Verification email sent successfully.');
        navigation.goBack();
      } else {
        Alert.alert('Failed', 'Could not send verification email.');
      }
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Parent Verification</Text>
        <Text style={styles.sub}>Enter your parent email to send a confirmation link.</Text>
        <TextInput
          value={parentEmail}
          onChangeText={setParentEmail}
          placeholder="Parent email"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Verification Email'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  title: { color: '#0f172a', fontWeight: '800', fontSize: 20 },
  sub: { color: '#475569', marginTop: 4, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
