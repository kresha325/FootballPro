import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateMyProfileRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { registerRoleLabel } from '../constants/registerRoles';

const COUNTRY_SUGGESTIONS = ['Kosovë', 'Shqipëri', 'Maqedoni e Veriut', 'Zvicër', 'Gjermani', 'Tjetër'];

export default function RegisterOnboardingScreen({ navigation }) {
  const { user, completeOnboarding, requiresParentVerification } = useAuth();
  const [step, setStep] = useState(1);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const role = user?.role || 'athlete';
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Përdorues';

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <View style={[styles.dot, step >= 1 && styles.dotActive]} />
          <View style={[styles.dot, step >= 2 && styles.dotActive]} />
        </View>

        <Text style={styles.welcome}>Mirë se erdhe, {name}!</Text>
        <View style={styles.roleBadgeWrap}>
          <Text style={styles.roleBadgeText}>{registerRoleLabel(role)}</Text>
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.title}>Ku luan / punon?</Text>
            <Text style={styles.sub}>
              Kjo ndihmon skautët dhe klubet të të gjejnë në rajonin tënd.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Qyteti (p.sh. Prishtinë)"
              value={city}
              onChangeText={setCity}
            />
            <Text style={styles.label}>Shteti / rajoni</Text>
            <View style={styles.chips}>
              {COUNTRY_SUGGESTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, country === c && styles.chipActive]}
                  onPress={() => setCountry(c)}
                >
                  <Text style={[styles.chipText, country === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ose shkruaj shtetin"
              value={country}
              onChangeText={setCountry}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.primaryBtnText}>Vazhdo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Prezantimi yt</Text>
            <Text style={styles.sub}>
              {role === 'athlete'
                ? 'Pozita, klubi, objektivi — mund ta ndryshosh më vonë.'
                : 'Një fjali për ty — klubet dhe lojtarët të njohin.'}
            </Text>
            <TextInput
              style={[styles.input, styles.bio]}
              placeholder="Bio (opsionale)"
              value={bio}
              onChangeText={setBio}
              multiline
            />
            <View style={styles.tips}>
              <Ionicons name="videocam" size={20} color="#0f766e" />
              <Text style={styles.tipText}>Pas kësaj: ngarko video ose nis LIVE nga profili.</Text>
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
              <Text style={styles.secondaryBtnText}>Hyr në app</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0fdfa' },
  container: { padding: 24, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#0f766e' },
  welcome: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  roleBadgeWrap: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  sub: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  bio: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  tips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tipText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#0f766e', fontWeight: '700' },
});
