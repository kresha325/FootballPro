import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  REGISTER_ROLE_OPTIONS,
  REGISTER_ROLE_VALUES,
  registerRoleLabel,
} from '../constants/registerRoles';
import { useAuth } from '../context/AuthContext';
import { APP_BRAND_NAME } from '../config/branding';

function RolePickerModal({ visible, selectedValue, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Lloji i llogarisë</Text>
          <FlatList
            data={REGISTER_ROLE_OPTIONS}
            keyExtractor={(item) => item.value}
            style={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalRow, item.value === selectedValue && styles.modalRowActive]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <View style={styles.modalRowBody}>
                  <Text style={styles.modalRowText}>{item.label}</Text>
                  {item.hint ? <Text style={styles.modalRowHint}>{item.hint}</Text> : null}
                </View>
                {item.value === selectedValue ? (
                  <Ionicons name="checkmark" size={20} color="#0f766e" />
                ) : null}
              </TouchableOpacity>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildIsoDate(y, m, d) {
  if (!y || !m || !d) return '';
  const yy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  if (yy.length !== 4 || mm.length !== 2 || dd.length !== 2) return '';
  return `${yy}-${mm}-${dd}`;
}

export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, register, forgotPassword, isSubmitting } = useAuth();
  const initialMode = route.params?.mode === 'register' ? 'register' : route.params?.mode === 'forgot' ? 'forgot' : 'login';
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    const next = route.params?.mode;
    if (next === 'login' || next === 'register' || next === 'forgot') {
      setMode(next);
    }
  }, [route.params?.mode]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('athlete');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const onLogin = async () => {
    setInlineError('');
    const result = await login({ email: email.trim().toLowerCase(), password });
    if (!result.ok) {
      setInlineError(result.message || 'Hyrja dështoi');
    }
  };

  const onRegister = async () => {
    setInlineError('');
    const normalizedRole = (role || 'athlete').trim().toLowerCase();
    if (!REGISTER_ROLE_VALUES.includes(normalizedRole)) {
      setInlineError('Zgjidh llojin e llogarisë.');
      return;
    }

    const dateOfBirth = buildIsoDate(dobYear, dobMonth, dobDay);
    if (!dateOfBirth) {
      setInlineError('Vendos datëlindjen (ditë, muaj, vit).');
      return;
    }

    if (!acceptedTerms) {
      setInlineError('Duhet të pranosh kushtet e përdorimit.');
      return;
    }

    const result = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: normalizedRole,
      dateOfBirth,
    });
    if (!result.ok) {
      setInlineError(result.message || 'Regjistrimi dështoi');
    }
  };

  const onForgotPassword = async () => {
    setInlineError('');
    const result = await forgotPassword(email.trim().toLowerCase());
    if (!result.ok) {
      setInlineError(result.message || 'Kërkesa dështoi');
      return;
    }
    if (result.resetUrl) {
      const match = String(result.resetUrl).match(/reset-password\/([^/?#]+)/i);
      const resetToken = match?.[1];
      if (resetToken) {
        navigation.navigate('ResetPassword', { token: resetToken });
        return;
      }
    }
    setMode('login');
    setInlineError(result.message || 'Kontrollo email-in.');
  };

  const onSubmit = async () => {
    setInlineError('');
    if (!email.trim()) {
      setInlineError('Vendos email-in.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setInlineError('Email jo valid.');
      return;
    }
    if (mode !== 'forgot' && !password) {
      setInlineError('Vendos fjalëkalimin.');
      return;
    }
    if (mode !== 'forgot' && password.length < 6) {
      setInlineError('Fjalëkalimi: të paktën 6 karaktere.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setInlineError('Fjalëkalimet nuk përputhen.');
      return;
    }
    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) {
      setInlineError('Vendos emrin dhe mbiemrin.');
      return;
    }
    if (mode === 'login') await onLogin();
    else if (mode === 'register') await onRegister();
    else await onForgotPassword();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" bounces={false}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
            <Text style={styles.backText}>Kthehu</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>
          <Text style={styles.titleX}>X</Text>
          <Text>{APP_BRAND_NAME.replace(/^x/i, '').trim()}</Text>
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Hyr për të vazhduar'
            : mode === 'register'
              ? 'Krijo llogarinë — karriera jote fillon këtu'
              : 'Rikupero fjalëkalimin'}
        </Text>

        {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}

        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Hyr</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Regjistrohu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'forgot' && styles.segmentBtnActive]}
            onPress={() => setMode('forgot')}
          >
            <Text style={[styles.segmentText, mode === 'forgot' && styles.segmentTextActive]}>Harruar?</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' ? (
          <>
            <TextInput style={styles.input} placeholder="Emri" value={firstName} onChangeText={setFirstName} />
            <TextInput style={styles.input} placeholder="Mbiemri" value={lastName} onChangeText={setLastName} />
            <Text style={styles.fieldLabel}>Lloji i llogarisë</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setRolePickerOpen(true)}>
              <Text style={styles.pickerBtnText}>{registerRoleLabel(role)}</Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.fieldLabel}>Datëlindja</Text>
            <View style={styles.dobRow}>
              <TextInput
                style={[styles.input, styles.dobInput]}
                placeholder="DD"
                value={dobDay}
                onChangeText={(v) => setDobDay(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.dobInput]}
                placeholder="MM"
                value={dobMonth}
                onChangeText={(v) => setDobMonth(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.dobInputWide]}
                placeholder="VVVV"
                value={dobYear}
                onChangeText={(v) => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <Text style={styles.hint}>Nën 18 vjeç: do të kërkohet email i prindit pas regjistrimit.</Text>
          </>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {mode !== 'forgot' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Fjalëkalimi"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {mode === 'register' ? (
              <TextInput
                style={styles.input}
                placeholder="Përsërit fjalëkalimin"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            ) : null}
          </>
        ) : null}

        {mode === 'register' ? (
          <View style={styles.termsRow}>
            <Switch value={acceptedTerms} onValueChange={setAcceptedTerms} trackColor={{ true: '#0f766e' }} />
            <Text style={styles.termsText}>Pranoj kushtet e përdorimit dhe privatësinë</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Hyr' : mode === 'register' ? 'Krijo llogarinë' : 'Dërgo linkun'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <RolePickerModal
        visible={rolePickerOpen}
        selectedValue={role}
        onSelect={setRole}
        onClose={() => setRolePickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0fdfa' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: '#0F172A', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' },
  titleX: { color: '#F59E0B' },
  subtitle: { marginTop: 6, marginBottom: 16, color: '#475569', lineHeight: 22 },
  segmentWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#0f766e' },
  segmentText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dobInput: { flex: 1, marginBottom: 0 },
  dobInputWide: { flex: 1.4, marginBottom: 0 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  pickerBtnText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  termsText: { flex: 1, fontSize: 13, color: '#475569' },
  inlineError: { marginBottom: 12, color: '#b91c1c', fontWeight: '600' },
  button: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', paddingHorizontal: 20, marginBottom: 8 },
  modalList: { maxHeight: 400 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  modalRowActive: { backgroundColor: '#f0fdfa' },
  modalRowBody: { flex: 1, paddingRight: 8 },
  modalRowText: { fontSize: 16, color: '#0f172a', fontWeight: '700' },
  modalRowHint: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
