import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractErrorMessage, updateMyProfileRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, refreshMe } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.Profile?.bio || '',
    city: user?.Profile?.city || '',
    country: user?.Profile?.country || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfileRequest(profile);
      await refreshMe();
      Alert.alert('Saved', 'Profile settings updated successfully.');
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to update settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Appearance</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Dark mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable notifications</Text>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Profile Settings</Text>
        <TextInput style={styles.input} value={profile.firstName} onChangeText={(v) => setProfile((p) => ({ ...p, firstName: v }))} placeholder="First name" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={profile.lastName} onChangeText={(v) => setProfile((p) => ({ ...p, lastName: v }))} placeholder="Last name" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={profile.bio} onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))} placeholder="Bio" placeholderTextColor="#94a3b8" multiline />
        <TextInput style={styles.input} value={profile.city} onChangeText={(v) => setProfile((p) => ({ ...p, city: v }))} placeholder="City" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={profile.country} onChangeText={(v) => setProfile((p) => ({ ...p, country: v }))} placeholder="Country" placeholderTextColor="#94a3b8" />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
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
    marginBottom: 10,
  },
  title: { color: '#0f172a', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  label: { color: '#334155' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  saveButton: {
    marginTop: 6,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
