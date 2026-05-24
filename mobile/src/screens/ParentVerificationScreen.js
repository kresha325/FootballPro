import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Share } from 'react-native';
import { extractErrorMessage, parentVerificationRequest } from '../api/client';

export default function ParentVerificationScreen({ navigation }) {
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmUrl, setConfirmUrl] = useState('');
  const [warning, setWarning] = useState('');
  const [emailSent, setEmailSent] = useState(null);

  const handleSend = async () => {
    const email = parentEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email jo valid', 'Vendos email-in e prindit.');
      return;
    }

    setLoading(true);
    setConfirmUrl('');
    setWarning('');
    try {
      const res = await parentVerificationRequest(email);
      const data = res?.data || {};

      if (!data.success) {
        Alert.alert('Gabim', data.error || 'Nuk u krijua verifikimi');
        return;
      }

      setEmailSent(!!data.emailSent);

      if (data.emailSent) {
        Alert.alert(
          'U dërgua',
          `Email u dërgua te ${email}. Kontrollo edhe Spam te prindi.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setWarning(
        data.warning ||
          'Email nuk u dërgua nga serveri. Kopjo linkun dhe ia dërgo prindit (WhatsApp).'
      );
      if (data.confirmUrl) setConfirmUrl(data.confirmUrl);
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  const shareLink = async () => {
    if (!confirmUrl) return;
    try {
      await Share.share({
        message: `Konfirmo llogarinë FootballPro të fëmijës:\n${confirmUrl}`,
      });
    } catch (_e) {
      Alert.alert('Linku', confirmUrl);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Verifikimi i prindit</Text>
        <Text style={styles.sub}>
          Për nën 18 vjeç. Vendos email-in e prindit — ose kopjo linkun nëse email nuk funksionon në server.
        </Text>

        {emailSent === true ? (
          <View style={styles.okBox}>
            <Text style={styles.okText}>Email u dërgua. Kontrollo Spam te prindi.</Text>
          </View>
        ) : null}

        {confirmUrl ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{warning}</Text>
            <Text style={styles.link} selectable>
              {confirmUrl}
            </Text>
            <TouchableOpacity style={styles.copyBtn} onPress={shareLink}>
              <Text style={styles.copyBtnText}>Ndaj linkun me prindin</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TextInput
          value={parentEmail}
          onChangeText={setParentEmail}
          placeholder="Email i prindit"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Duke dërguar…' : 'Dërgo / krijo link'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 14, paddingBottom: 30 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  title: { color: '#0f172a', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  sub: { color: '#64748b', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  okBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  okText: { color: '#065f46', fontSize: 13 },
  warnBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warnText: { color: '#92400e', fontSize: 13, marginBottom: 8 },
  link: { fontSize: 11, color: '#0f766e', marginBottom: 10 },
  copyBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyBtnText: { color: '#fff', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
