import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createMyProfileRequest, extractErrorMessage, myProfileRequest, updateMyProfileRequest } from '../api/client';

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    city: '',
    country: '',
    club: '',
    position: '',
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await myProfileRequest();
        const p = res.data || {};
        setForm((prev) => ({
          ...prev,
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
          gender: p.gender || '',
          bio: p.bio || '',
          city: p.city || '',
          country: p.country || '',
          club: p.club || '',
          position: p.position || '',
        }));
      } catch (_err) {
        // Keep empty form for first-time profile creation.
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        gender: form.gender.trim() || undefined,
        bio: form.bio.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        club: form.club.trim() || undefined,
        position: form.position.trim() || undefined,
      };

      try {
        await updateMyProfileRequest(payload);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          await createMyProfileRequest(payload);
          await updateMyProfileRequest(payload);
        } else {
          throw err;
        }
      }

      Alert.alert('Success', 'Profile updated successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Update failed', extractErrorMessage(err, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>First name</Text>
      <TextInput style={styles.input} value={form.firstName} onChangeText={(v) => setField('firstName', v)} />

      <Text style={styles.label}>Last name</Text>
      <TextInput style={styles.input} value={form.lastName} onChangeText={(v) => setField('lastName', v)} />

      <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={form.dateOfBirth} onChangeText={(v) => setField('dateOfBirth', v)} />

      <Text style={styles.label}>Gender</Text>
      <TextInput style={styles.input} value={form.gender} onChangeText={(v) => setField('gender', v)} />

      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, styles.multiline]} value={form.bio} onChangeText={(v) => setField('bio', v)} multiline />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={form.city} onChangeText={(v) => setField('city', v)} />

      <Text style={styles.label}>Country</Text>
      <TextInput style={styles.input} value={form.country} onChangeText={(v) => setField('country', v)} />

      <Text style={styles.label}>Club</Text>
      <TextInput style={styles.input} value={form.club} onChangeText={(v) => setField('club', v)} />

      <Text style={styles.label}>Position</Text>
      <TextInput style={styles.input} value={form.position} onChangeText={(v) => setField('position', v)} />

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save profile'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 28 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#334155', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  button: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
