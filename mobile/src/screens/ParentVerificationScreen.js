import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { extractErrorMessage, parentVerificationRequest } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';

export default function ParentVerificationScreen() {
  const { t } = useLocale();
  const { logout, refreshMe } = useAuth();
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState('');
  const [emailSent, setEmailSent] = useState(null);

  const handleSend = async () => {
    const email = parentEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email jo valid', 'Vendos email-in e prindit.');
      return;
    }

    setLoading(true);
    setWarning('');
    try {
      const res = await parentVerificationRequest(email);
      const data = res?.data || {};

      if (!data.success) {
        Alert.alert('Gabim', data.error || 'Nuk u krijua verifikimi');
        return;
      }

      if (data.alreadyAuthorized) {
        setEmailSent(null);
        Alert.alert('Autorizimi është aktiv', 'Llogaria tashmë ka autorizim prindëror aktiv.');
        return;
      }

      setEmailSent(!!data.emailSent);

      if (data.warning) setWarning(data.warning);

      if (data.emailSent) {
        Alert.alert('U dërgua', `Kërkesa u dërgua te ${email}. Kujdestari duhet të hapë emailin dhe të plotësojë deklarimin.`);
        return;
      }

      setWarning(data.warning || 'Email-i nuk u dërgua. Provo përsëri më vonë ose kontakto mbështetjen. Linku i autorizimit nuk mund të ndahet nga llogaria e atletit.');
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Verifikimi i prindit</Text>
        <Text style={styles.sub}>
          Për nën 18 vjeç. Vendos email-in e prindit ose kujdestarit ligjor. Linku i autorizimit dërgohet vetëm në atë email.
        </Text>

        {emailSent === true ? (
          <View style={styles.okBox}>
            <Text style={styles.okText}>Email u dërgua. Kontrollo Spam te prindi.</Text>
          </View>
        ) : null}

        {emailSent === false && warning ? <View style={styles.warnBox}><Text style={styles.warnText}>{warning}</Text></View> : null}

        <TextInput
          value={parentEmail}
          onChangeText={setParentEmail}
          placeholder={t('Email i prindit')}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Duke dërguar…' : 'Dërgo email autorizimi'}</Text>
        </TouchableOpacity>
        {emailSent === true ? <TouchableOpacity style={[styles.button, styles.statusButton]} onPress={() => refreshMe().then((me) => Alert.alert(me?.parentAuthorizationPending ? 'Në pritje' : 'U autorizua', me?.parentAuthorizationPending ? 'Ende nuk është përfunduar autorizimi.' : 'Autorizimi është aktiv. Hyr sërish në aplikacion.')).catch(() => Alert.alert('Gabim', 'Nuk u kontrollua statusi.'))}><Text style={styles.buttonText}>Kontrollo statusin</Text></TouchableOpacity> : null}
        <TouchableOpacity style={[styles.button, styles.statusButton]} onPress={logout}><Text style={styles.buttonText}>Dil nga llogaria</Text></TouchableOpacity>
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
  statusButton: { marginTop: 8, backgroundColor: '#475569' },
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
    backgroundColor: '#9A6B12',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
