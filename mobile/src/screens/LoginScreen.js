import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
} from '../theme/nativeComponents';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  REGISTER_ROLE_OPTIONS,
  REGISTER_ROLE_VALUES,
  registerRoleLabel,
} from '../constants/registerRoles';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { APP_BRAND_WORDMARK } from '../config/branding';
import { BACKEND_URL, WEB_APP_URL } from '../config/constants';
import { isOrgProfileRole } from '../utils/orgProfile';
import { oauthProvidersRequest } from '../api/client';

const WEB_BASE = (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');
const PRIVACY_URL = `${WEB_BASE}/privacy`;
const TERMS_URL = `${WEB_BASE}/terms`;
const HELP_URL = `${WEB_BASE}/help`;
const API_ROOT = String(BACKEND_URL || '').replace(/\/$/, '').replace(/\/api$/i, '');

function RolePickerModal({ visible, selectedValue, onSelect, onClose, colors }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>Lloji i llogarisë</Text>
          <FlatList
            data={REGISTER_ROLE_OPTIONS}
            keyExtractor={(item) => item.value}
            style={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalRow,
                  { borderBottomColor: colors.border },
                  item.value === selectedValue && { backgroundColor: colors.primarySoft },
                ]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <View style={styles.modalRowBody}>
                  <Text style={[styles.modalRowText, { color: colors.text }]}>{item.label}</Text>
                  {item.hint ? (
                    <Text style={[styles.modalRowHint, { color: colors.muted }]}>{item.hint}</Text>
                  ) : null}
                </View>
                {item.value === selectedValue ? (
                  <Ionicons name="checkmark" size={20} color={colors.primaryText} />
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
  const { colors } = useTheme();
  const { login, register, forgotPassword, isSubmitting } = useAuth();
  const initialMode =
    route.params?.mode === 'register' ? 'register' : route.params?.mode === 'forgot' ? 'forgot' : 'login';
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
  const [oauthProviders, setOauthProviders] = useState({ google: false, facebook: false, apple: false });

  useEffect(() => {
    let cancelled = false;
    oauthProvidersRequest()
      .then((res) => {
        if (cancelled) return;
        setOauthProviders({
          google: !!res?.data?.google,
          facebook: !!res?.data?.facebook,
          apple: !!res?.data?.apple,
        });
      })
      .catch(() => {
        if (!cancelled) setOauthProviders({ google: false, facebook: false, apple: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startOAuth = (provider) => {
    const url = `${API_ROOT}/api/auth/${provider}?app=1`;
    Linking.openURL(url).catch(() => {
      setInlineError('Nuk u hap hyrja sociale. Provo përsëri.');
    });
  };

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const themed = useMemo(
    () => ({
      root: { flex: 1, backgroundColor: colors.bg },
      backText: { color: colors.text },
      title: { color: colors.text },
      subtitle: { color: colors.muted },
      segmentWrap: { backgroundColor: colors.bgElevated },
      segmentText: { color: colors.textSecondary },
      fieldLabel: { color: colors.muted },
      hint: { color: colors.muted },
      input: {
        backgroundColor: colors.inputBg,
        borderColor: colors.inputBorder,
        color: colors.text,
      },
      pickerBtn: {
        backgroundColor: colors.inputBg,
        borderColor: colors.inputBorder,
      },
      pickerBtnText: { color: colors.text },
      termsText: { color: colors.muted },
      termsLink: { color: colors.primaryText },
      helpLinkText: { color: colors.primaryText },
      inlineError: { color: colors.danger },
    }),
    [colors]
  );

  const inputProps = {
    placeholderTextColor: colors.mutedSoft,
    selectionColor: colors.primary,
  };

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

    const isAthlete = normalizedRole === 'athlete';
    const isOrg = isOrgProfileRole(normalizedRole);
    let dateOfBirth;
    if (isAthlete) {
      dateOfBirth = buildIsoDate(dobYear, dobMonth, dobDay);
      if (!dateOfBirth) {
        setInlineError('Vendos datëlindjen (ditë, muaj, vit).');
        return;
      }
    }

    if (!acceptedTerms) {
      setInlineError('Duhet të pranosh kushtet e përdorimit.');
      return;
    }

    const result = await register({
      firstName: firstName.trim(),
      lastName: isOrg ? '' : lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: normalizedRole,
      ...(dateOfBirth ? { dateOfBirth } : {}),
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
    }
  };

  const onSubmit = () => {
    setInlineError('');
    if (!email.trim() || !isValidEmail(email.trim())) {
      setInlineError('Vendos një email të vlefshëm.');
      return;
    }
    if (mode === 'forgot') {
      onForgotPassword();
      return;
    }
    if (!password) {
      setInlineError('Vendos fjalëkalimin.');
      return;
    }
    if (mode === 'register') {
      if (!firstName.trim()) {
        setInlineError(isOrgProfileRole(role) ? 'Vendos emrin e organizatës.' : 'Vendos emrin dhe mbiemrin.');
        return;
      }
      if (!isOrgProfileRole(role) && !lastName.trim()) {
        setInlineError('Vendos emrin dhe mbiemrin.');
        return;
      }
      if (password !== confirmPassword) {
        setInlineError('Fjalëkalimet nuk përputhen.');
        return;
      }
      if (password.length < 6) {
        setInlineError('Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
        return;
      }
      onRegister();
      return;
    }
    onLogin();
  };

  return (
    <KeyboardAvoidingView
      style={themed.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        keyboardDismissMode="on-drag"
      >
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={[styles.backText, themed.backText]}>Kthehu</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.title, themed.title]}>
          <Text style={styles.titleX}>X</Text>
          <Text>{APP_BRAND_WORDMARK}</Text>
        </Text>
        <Text style={[styles.subtitle, themed.subtitle]}>
          {mode === 'login'
            ? 'Hyr për të vazhduar'
            : mode === 'register'
              ? 'Krijo llogarinë — karriera jote fillon këtu'
              : 'Rikupero fjalëkalimin'}
        </Text>

        {inlineError ? <Text style={[styles.inlineError, themed.inlineError]}>{inlineError}</Text> : null}

        <View style={[styles.segmentWrap, themed.segmentWrap]}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
            onPress={() => setMode('login')}
          >
            <Text
              style={[
                styles.segmentText,
                themed.segmentText,
                mode === 'login' && styles.segmentTextActive,
              ]}
            >
              Hyr
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
            onPress={() => setMode('register')}
          >
            <Text
              style={[
                styles.segmentText,
                themed.segmentText,
                mode === 'register' && styles.segmentTextActive,
              ]}
            >
              Regjistrohu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'forgot' && styles.segmentBtnActive]}
            onPress={() => setMode('forgot')}
          >
            <Text
              style={[
                styles.segmentText,
                themed.segmentText,
                mode === 'forgot' && styles.segmentTextActive,
              ]}
            >
              Harruar?
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' ? (
          <>
            <TextInput
              style={[styles.input, themed.input]}
              placeholder={isOrgProfileRole(role) ? 'Emri i organizatës' : 'Emri'}
              value={firstName}
              onChangeText={setFirstName}
              {...inputProps}
            />
            {!isOrgProfileRole(role) ? (
              <TextInput
                style={[styles.input, themed.input]}
                placeholder="Mbiemri"
                value={lastName}
                onChangeText={setLastName}
                {...inputProps}
              />
            ) : null}
            <Text style={[styles.fieldLabel, themed.fieldLabel]}>Lloji i llogarisë</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, themed.pickerBtn]}
              onPress={() => setRolePickerOpen(true)}
            >
              <Text style={[styles.pickerBtnText, themed.pickerBtnText]}>{registerRoleLabel(role)}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.muted} />
            </TouchableOpacity>
            {String(role || '').toLowerCase() === 'athlete' ? (
              <>
                <Text style={[styles.fieldLabel, themed.fieldLabel]}>Datëlindja</Text>
                <View style={styles.dobRow}>
                  <TextInput
                    style={[styles.input, styles.dobInput, themed.input]}
                    placeholder="DD"
                    value={dobDay}
                    onChangeText={(v) => setDobDay(v.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    {...inputProps}
                  />
                  <TextInput
                    style={[styles.input, styles.dobInput, themed.input]}
                    placeholder="MM"
                    value={dobMonth}
                    onChangeText={(v) => setDobMonth(v.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    {...inputProps}
                  />
                  <TextInput
                    style={[styles.input, styles.dobInputWide, themed.input]}
                    placeholder="VVVV"
                    value={dobYear}
                    onChangeText={(v) => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    {...inputProps}
                  />
                </View>
                <Text style={[styles.hint, themed.hint]}>
                  Nën 18 vjeç: do të kërkohet email i prindit pas regjistrimit.
                </Text>
              </>
            ) : null}
          </>
        ) : null}

        <TextInput
          style={[styles.input, themed.input]}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          spellCheck={false}
          importantForAutofill="yes"
          {...inputProps}
        />
        {mode !== 'forgot' ? (
          <>
            <TextInput
              style={[styles.input, themed.input]}
              placeholder="Fjalëkalimi"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              {...inputProps}
            />
            {mode === 'register' ? (
              <TextInput
                style={[styles.input, themed.input]}
                placeholder="Përsërit fjalëkalimin"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                {...inputProps}
              />
            ) : null}
          </>
        ) : null}

        {mode === 'register' ? (
          <View style={styles.termsRow}>
            <Switch
              value={acceptedTerms}
              onValueChange={setAcceptedTerms}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
            <Text style={[styles.termsText, themed.termsText]}>
              Pranoj{' '}
              <Text style={[styles.termsLink, themed.termsLink]} onPress={() => Linking.openURL(TERMS_URL)}>
                kushtet
              </Text>
              {' '}dhe{' '}
              <Text style={[styles.termsLink, themed.termsLink]} onPress={() => Linking.openURL(PRIVACY_URL)}>
                privatësinë
              </Text>
            </Text>
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

        {mode !== 'forgot' && (oauthProviders.google || oauthProviders.facebook || oauthProviders.apple) ? (
          <View style={styles.oauthWrap}>
            <View style={styles.oauthDividerRow}>
              <View style={[styles.oauthLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.oauthOr, { color: colors.muted }]}>ose</Text>
              <View style={[styles.oauthLine, { backgroundColor: colors.border }]} />
            </View>
            {oauthProviders.apple ? (
              <TouchableOpacity
                style={[styles.oauthBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => startOAuth('apple')}
                disabled={isSubmitting}
              >
                <Ionicons name="logo-apple" size={18} color={colors.text} />
                <Text style={[styles.oauthBtnText, { color: colors.text }]}>Vazhdo me Apple</Text>
              </TouchableOpacity>
            ) : null}
            {oauthProviders.google ? (
              <TouchableOpacity
                style={[styles.oauthBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => startOAuth('google')}
                disabled={isSubmitting}
              >
                <Ionicons name="logo-google" size={18} color={colors.text} />
                <Text style={[styles.oauthBtnText, { color: colors.text }]}>Vazhdo me Google</Text>
              </TouchableOpacity>
            ) : null}
            {oauthProviders.facebook ? (
              <TouchableOpacity
                style={[styles.oauthBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => startOAuth('facebook')}
                disabled={isSubmitting}
              >
                <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                <Text style={[styles.oauthBtnText, { color: colors.text }]}>Vazhdo me Facebook</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity onPress={() => Linking.openURL(HELP_URL)} style={styles.helpLink}>
          <Text style={[styles.helpLinkText, themed.helpLinkText]}>Ndihmë & FAQ</Text>
        </TouchableOpacity>
      </ScrollView>

      <RolePickerModal
        visible={rolePickerOpen}
        selectedValue={role}
        onSelect={(value) => {
          setRole(value);
          if (isOrgProfileRole(value)) setLastName('');
        }}
        onClose={() => setRolePickerOpen(false)}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 12 },
  backText: { fontWeight: '600', fontSize: 15 },
  title: { fontSize: 30, fontWeight: '800', textTransform: 'uppercase' },
  titleX: { color: '#F59E0B' },
  subtitle: { marginTop: 6, marginBottom: 16, lineHeight: 22 },
  segmentWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#9A6B12' },
  segmentText: { fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    fontSize: 16,
  },
  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dobInput: { flex: 1, marginBottom: 0 },
  dobInputWide: { flex: 1.4, marginBottom: 0 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  pickerBtnText: { fontSize: 16, fontWeight: '600' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  termsText: { flex: 1, fontSize: 13 },
  termsLink: { fontWeight: '700', textDecorationLine: 'underline' },
  helpLink: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  helpLinkText: { fontWeight: '700', fontSize: 13 },
  inlineError: { marginBottom: 12, fontWeight: '600' },
  button: {
    marginTop: 8,
    backgroundColor: '#9A6B12',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  oauthWrap: { marginTop: 16, gap: 10 },
  oauthDividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  oauthLine: { flex: 1, height: StyleSheet.hairlineWidth },
  oauthOr: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  oauthBtn: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  oauthBtnText: { fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', paddingHorizontal: 20, marginBottom: 8 },
  modalList: { maxHeight: 400 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalRowBody: { flex: 1, paddingRight: 8 },
  modalRowText: { fontSize: 16, fontWeight: '700' },
  modalRowHint: { fontSize: 12, marginTop: 2 },
});
