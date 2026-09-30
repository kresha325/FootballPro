import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import { updateMyProfileRequest } from '../api/client';
import AiBioButton from '../components/AiBioButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { registerRoleLabel } from '../constants/registerRoles';

const COUNTRY_SUGGESTIONS = ['Kosovë', 'Shqipëri', 'Maqedoni e Veriut', 'Zvicër', 'Gjermani', 'Tjetër'];

export default function RegisterOnboardingScreen({ navigation }) {
  const { user, completeOnboarding, requiresParentVerification } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const role = user?.role || 'athlete';
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Përdorues';

  const themed = useMemo(
    () => ({
      root: { flex: 1, backgroundColor: colors.bg },
      welcome: { color: colors.text },
      title: { color: colors.text },
      sub: { color: colors.muted },
      label: { color: colors.textSecondary },
      roleBadge: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
      },
      roleBadgeText: { color: colors.primaryText },
      input: {
        backgroundColor: colors.card,
        borderColor: colors.borderStrong,
        color: colors.text,
      },
      chip: {
        backgroundColor: colors.card,
        borderColor: colors.borderStrong,
      },
      chipText: { color: colors.text },
      tips: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      tipText: { color: colors.muted },
      secondaryBtnText: { color: colors.primaryText },
      dot: { backgroundColor: colors.border },
    }),
    [colors]
  );

  const finish = async (goEditProfile) => {
    setSaving(true);
    try {
      if (city.trim() || country.trim() || bio.trim()) {
        await updateMyProfileRequest({
          city: city.trim(),
          country: country.trim(),
          bio: bio.trim(),
        });
      }
      await completeOnboarding();

      if (requiresParentVerification) {
        Alert.alert(
          'Verifikimi i prindit',
          'Je nën 18 vjeç. Dërgo email verifikimi te prindi për të përdorur të gjitha funksionet.',
          [
            {
              text: 'Tani',
              onPress: () =>
                navigation.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Main',
                      state: {
                        routes: [
                          {
                            name: 'More',
                            state: { routes: [{ name: 'ParentVerification' }] },
                          },
                        ],
                      },
                    },
                  ],
                }),
            },
            {
              text: 'Më vonë',
              style: 'cancel',
              onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }),
            },
          ]
        );
        return;
      }

      if (goEditProfile) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: [
                  {
                    name: 'Profile',
                    state: { routes: [{ name: 'EditProfile' }] },
                  },
                ],
              },
            },
          ],
        });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err) {
      Alert.alert('Gabim', err?.message || 'Nuk u ruajt profili');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={themed.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <View style={[styles.dot, themed.dot, step >= 1 && styles.dotActive]} />
          <View style={[styles.dot, themed.dot, step >= 2 && styles.dotActive]} />
        </View>

        <Text style={[styles.welcome, themed.welcome]}>Mirë se erdhe, {name}!</Text>
        <View style={[styles.roleBadgeWrap, themed.roleBadge]}>
          <Text style={[styles.roleBadgeText, themed.roleBadgeText]}>{registerRoleLabel(role)}</Text>
        </View>

        {step === 1 ? (
          <>
            <Text style={[styles.title, themed.title]}>Ku luan / punon?</Text>
            <Text style={[styles.sub, themed.sub]}>
              Kjo ndihmon skautët dhe klubet të të gjejnë në rajonin tënd.
            </Text>
            <TextInput
              style={[styles.input, themed.input]}
              placeholder="Qyteti (p.sh. Prishtinë)"
              placeholderTextColor={colors.mutedSoft}
              value={city}
              onChangeText={setCity}
            />
            <Text style={[styles.label, themed.label]}>Shteti / rajoni</Text>
            <View style={styles.chips}>
              {COUNTRY_SUGGESTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, themed.chip, country === c && styles.chipActive]}
                  onPress={() => setCountry(c)}
                >
                  <Text style={[styles.chipText, themed.chipText, country === c && styles.chipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, themed.input]}
              placeholder="Ose shkruaj shtetin"
              placeholderTextColor={colors.mutedSoft}
              value={country}
              onChangeText={setCountry}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.primaryBtnText}>Vazhdo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, themed.title]}>Prezantimi yt</Text>
            <Text style={[styles.sub, themed.sub]}>
              {role === 'athlete'
                ? 'Pozita, klubi, objektivi — mund ta ndryshosh më vonë.'
                : 'Një fjali për ty — klubet dhe lojtarët të njohin.'}
            </Text>
            <AiBioButton
              hints={{ city, country, extra: 'Regjistrim i ri në X TALENTI' }}
              onBio={setBio}
            />
            <TextInput
              style={[styles.input, themed.input, styles.bio]}
              placeholder="Bio (opsionale)"
              placeholderTextColor={colors.mutedSoft}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
            />
            <View style={[styles.tips, themed.tips]}>
              <Ionicons name="videocam" size={20} color={colors.primaryText} />
              <Text style={[styles.tipText, themed.tipText]}>
                Pas kësaj: ngarko video ose nis LIVE nga profili.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              disabled={saving}
              onPress={() => finish(true)}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Plotëso profilin</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} disabled={saving} onPress={() => finish(false)}>
              <Text style={[styles.secondaryBtnText, themed.secondaryBtnText]}>Hyr në app</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  dotActive: { backgroundColor: '#9A6B12' },
  welcome: { fontSize: 26, fontWeight: '800' },
  roleBadgeWrap: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleBadgeText: { fontWeight: '700', fontSize: 13 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    fontSize: 16,
  },
  bio: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: '#9A6B12', borderColor: '#9A6B12' },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  tips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#9A6B12',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontWeight: '700' },
});
