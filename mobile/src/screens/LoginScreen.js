import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, register, forgotPassword, isSubmitting } = useAuth();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('athlete');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inlineError, setInlineError] = useState('');

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const onLogin = async () => {
    setInlineError('');
    const result = await login({ email: email.trim(), password });
    if (!result.ok) {
      setInlineError(result.message || 'Login failed');
    }
  };

  const onRegister = async () => {
    setInlineError('');
    const normalizedRole = (role || 'athlete').trim().toLowerCase();
    const result = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      role: normalizedRole || 'athlete',
    });
    if (!result.ok) {
      setInlineError(result.message || 'Register failed');
    }
  };

  const onForgotPassword = async () => {
    setInlineError('');
    const result = await forgotPassword(email.trim());
    if (!result.ok) {
      setInlineError(result.message || 'Reset request failed');
      return;
    }
    const extra = result.resetUrl ? `\n\nReset URL (dev):\n${result.resetUrl}` : '';
    Alert.alert('Password reset', `${result.message}${extra}`);
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
    <View style={styles.container}>
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
          <TextInput
            style={styles.input}
            placeholder="Role (athlete, coach, scout...)"
            value={role}
            onChangeText={setRole}
            autoCapitalize="none"
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f7faf9',
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
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    backgroundColor: '#fff',
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
});
