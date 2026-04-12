import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [coverPhotoFile, setCoverPhotoFile] = useState(null);

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

  const pickImage = async (type) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow media library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: `${type}-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      };
      if (type === 'profilePhoto') {
        setProfilePhotoFile(file);
      } else {
        setCoverPhotoFile(file);
      }
    }
  };

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
        profilePhoto: profilePhotoFile || undefined,
        coverPhoto: coverPhotoFile || undefined,
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
      <Text style={styles.label}>Avatar (profile photo)</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => pickImage('profilePhoto')}>
        <Text style={styles.secondaryButtonText}>{profilePhotoFile ? 'Change Avatar' : 'Choose Avatar'}</Text>
      </TouchableOpacity>
      {profilePhotoFile ? <Image source={{ uri: profilePhotoFile.uri }} style={styles.avatarPreview} /> : null}

      <Text style={styles.label}>Cover photo</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => pickImage('coverPhoto')}>
        <Text style={styles.secondaryButtonText}>{coverPhotoFile ? 'Change Cover' : 'Choose Cover'}</Text>
      </TouchableOpacity>
      {coverPhotoFile ? <Image source={{ uri: coverPhotoFile.uri }} style={styles.coverPreview} /> : null}

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
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  avatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
  },
  coverPreview: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
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
