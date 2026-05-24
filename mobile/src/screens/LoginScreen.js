import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  REGISTER_ROLE_OPTIONS,
  REGISTER_ROLE_VALUES,
  registerRoleLabel,
} from '../constants/registerRoles';
import { useAuth } from '../context/AuthContext';

function RolePickerModal({ visible, selectedValue, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Account type</Text>
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
                <Text style={styles.modalRowText}>{item.label}</Text>
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

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, register, forgotPassword, isSubmitting } = useAuth();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('athlete');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inlineError, setInlineError] = useState('');

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const onLogin = async () => {
    setInlineError('');
    const result = await login({ email: email.trim().toLowerCase(), password });
    if (!result.ok) {
      setInlineError(result.message || 'Login failed');
    }
  };

  const onRegister = async () => {
    setInlineError('');
    const normalizedRole = (role || 'athlete').trim().toLowerCase();
    if (!REGISTER_ROLE_VALUES.includes(normalizedRole)) {
      setInlineError('Please select a valid account type.');
      return;
    }
    const result = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: normalizedRole,
    });
    if (!result.ok) {
      setInlineError(result.message || 'Register failed');
    }
  };

  const onForgotPassword = async () => {
    setInlineError('');
    const result = await forgotPassword(email.trim().toLowerCase());
    if (!result.ok) {
      setInlineError(result.message || 'Reset request failed');
      return;
    }
    if (result.resetUrl) {
      const match = String(result.resetUrl).match(/reset-password\/([^/?#]+)/i);
      const resetToken = match?.[1];
      if (resetToken) {
        Alert.alert('Password reset', result.message, [
          { text: 'OK', onPress: () => navigation.navigate('ResetPassword', { token: resetToken }) },
        ]);
        return;
      }
      Alert.alert('Password reset', `${result.message}\n\n${result.resetUrl}`);
    } else {
      Alert.alert('Password reset', result.message);
    }
    setMode('login');
  };

  const onSubmit = async () => {
    setInlineError('');
    if (!email.trim()) {
      setInlineError('Please enter email.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setInlineError('Please enter a valid email address.');
      return;
    }

    if (mode !== 'forgot' && !password) {
      setInlineError('Please enter password.');
      return;
    }

    if (mode !== 'forgot' && password.length < 6) {
      setInlineError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) {
      setInlineError('Please enter first and last name.');
      return;
    }

    if (mode === 'login') {
      await onLogin();
      return;
    }

    if (mode === 'register') {
      await onRegister();
      return;
    }

    await onForgotPassword();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={styles.title}>FootballPro Mobile</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to continue' : mode === 'register' ? 'Create your account' : 'Recover your password'}
        </Text>

        {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}

        <View style={styles.segmentWrap}>
          <TouchableOpacity style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]} onPress={() => setMode('login')}>
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]} onPress={() => setMode('register')}>
            <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, mode === 'forgot' && styles.segmentBtnActive]} onPress={() => setMode('forgot')}>
            <Text style={[styles.segmentText, mode === 'forgot' && styles.segmentTextActive]}>Forgot</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
            />
            <Text style={styles.fieldLabel}>Account type</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setRolePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Select account type"
            >
              <Text style={styles.pickerBtnText}>{registerRoleLabel(role)}</Text>
              <Ionicons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
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
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        ) : null}

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
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
  flex: { flex: 1, backgroundColor: '#f7faf9' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f766e',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: '#4b5563',
  },
  segmentWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#0f766e',
  },
  segmentText: {
    color: '#334155',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
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
  pickerBtnText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  inlineError: {
    marginBottom: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  modalList: {
    maxHeight: 360,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  modalRowActive: {
    backgroundColor: '#f0fdfa',
  },
  modalRowText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
});
