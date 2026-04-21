import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  clubMembersRequestMembership,
  createMyProfileRequest,
  extractErrorMessage,
  myProfileRequest,
  profilesRequest,
  submitClubRosterRequest,
  updateMyProfileRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ATHLETE_POSITIONS,
  COACH_AFFILIATIONS,
  COACH_CATEGORIES,
  GENDER_OPTIONS,
  PREFERRED_FOOT_OPTIONS,
} from './editProfileConstants';

function normalizeEditRole(role) {
  const r = String(role || 'athlete').toLowerCase();
  if (r === 'trajner') return 'coach';
  return r;
}

function careerHistoryToString(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

function contactToString(raw) {
  if (raw == null || raw === '') return '{}';
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
  return String(raw);
}

function OptionPickerModal({ visible, title, options, selectedValue, field, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item, idx) => `${item.value}-${idx}`}
            style={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalRow, item.value === selectedValue && styles.modalRowActive]}
                onPress={() => {
                  onSelect(field, item.value);
                  onClose();
                }}
              >
                <Text style={styles.modalRowText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const defaultForm = () => ({
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  bio: '',
  city: '',
  country: '',
  club: '',
  position: '',
  height: '',
  weight: '',
  preferredFoot: 'right',
  jerseyNumber: '',
  coachAffiliation: '',
  coachCategory: '',
  careerHistory: '',
  contactJson: '{}',
  industry: '',
  founded: '',
  companySize: '',
  revenue: '',
  employees: '',
  partnerships: '',
  countries: '',
  phone: '',
  instagram: '',
  twitter: '',
  facebook: '',
  selectedClubId: null,
});

export default function EditProfileScreen({ navigation }) {
  const { user, refreshMe } = useAuth();
  const editRole = useMemo(() => normalizeEditRole(user?.role), [user?.role]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [clubSuggestions, setClubSuggestions] = useState([]);

  const [picker, setPicker] = useState({ open: false, field: null, title: '', options: [] });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openPicker = (field, title, options) => {
    setPicker({ open: true, field, title, options });
  };

  const onPickerSelect = (field, value) => {
    if (field) setField(field, value);
    setPicker((p) => ({ ...p, open: false }));
  };

  useEffect(() => {
    const load = async () => {
      if (editRole === 'liga') {
        setLoading(false);
        return;
      }
      try {
        const res = await myProfileRequest();
        const p = res.data || {};
        const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
        setExistingPhotoUrl(typeof p.profilePhoto === 'string' ? p.profilePhoto : '');
        setForm({
          ...defaultForm(),
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
          gender: p.gender || '',
          bio: p.bio || '',
          city: p.city || '',
          country: p.country || '',
          club: p.club || '',
          position: p.position || '',
          height: stats.height != null ? String(stats.height) : '',
          weight: stats.weight != null ? String(stats.weight) : '',
          preferredFoot: stats.preferredFoot || 'right',
          jerseyNumber: stats.jerseyNumber != null ? String(stats.jerseyNumber) : '',
          coachAffiliation: p.coachAffiliation || '',
          coachCategory: p.coachCategory || '',
          careerHistory: careerHistoryToString(p.careerHistory),
          contactJson: contactToString(p.contact),
          industry: stats.industry != null ? String(stats.industry) : '',
          founded: stats.founded != null ? String(stats.founded) : '',
          companySize: stats.companySize != null ? String(stats.companySize) : '',
          revenue: stats.revenue != null ? String(stats.revenue) : '',
          employees: stats.employees != null ? String(stats.employees) : '',
          partnerships: stats.partnerships != null ? String(stats.partnerships) : '',
          countries: stats.countries != null ? String(stats.countries) : '',
          phone: p.contact?.phone != null ? String(p.contact.phone) : '',
          instagram: p.contact?.instagram != null ? String(p.contact.instagram) : '',
          twitter: p.contact?.twitter != null ? String(p.contact.twitter) : '',
          facebook: p.contact?.facebook != null ? String(p.contact.facebook) : '',
          selectedClubId: p.clubId != null ? Number(p.clubId) : null,
        });
      } catch (_err) {
        // first-time profile
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [editRole]);

  useEffect(() => {
    if (!['athlete', 'coach'].includes(editRole)) {
      setClubSuggestions([]);
      return;
    }
    const q = (form.club || '').trim();
    if (!q) {
      setClubSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await profilesRequest({ role: 'club', search: q, limit: 8 });
        setClubSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch (_e) {
        setClubSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.club, editRole]);

  const pickImage = async () => {
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
      setProfilePhotoFile({
        uri: asset.uri,
        name: `profilePhoto-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const buildPayload = useCallback(() => {
    const payload = {};
    if (profilePhotoFile) payload.profilePhoto = profilePhotoFile;

    const trim = (s) => (typeof s === 'string' ? s.trim() : '');
    const add = (key, val) => {
      if (val === undefined || val === null) return;
      if (typeof val === 'string' && val === '') return;
      payload[key] = val;
    };

    switch (editRole) {
      case 'athlete':
        add('firstName', trim(form.firstName));
        add('lastName', trim(form.lastName));
        add('dateOfBirth', trim(form.dateOfBirth));
        add('gender', form.gender);
        add('bio', trim(form.bio));
        add('position', trim(form.position));
        add('club', trim(form.club));
        add('city', trim(form.city));
        add('country', trim(form.country));
        if (form.selectedClubId) payload.clubId = form.selectedClubId;
        payload.stats = {
          height: trim(form.height),
          weight: trim(form.weight),
          preferredFoot: form.preferredFoot || 'right',
          jerseyNumber: trim(form.jerseyNumber),
        };
        break;
      case 'coach':
        add('firstName', trim(form.firstName));
        add('lastName', trim(form.lastName));
        add('bio', trim(form.bio));
        add('club', trim(form.club));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('coachAffiliation', form.coachAffiliation);
        add('coachCategory', form.coachCategory);
        add('careerHistory', trim(form.careerHistory));
        if (form.selectedClubId) payload.clubId = form.selectedClubId;
        break;
      case 'scout':
      case 'manager':
        add('firstName', trim(form.firstName));
        add('lastName', trim(form.lastName));
        add('club', trim(form.club));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('bio', trim(form.bio));
        add('careerHistory', trim(form.careerHistory));
        try {
          payload.contact = JSON.parse(form.contactJson || '{}');
        } catch {
          payload.contact = {};
        }
        break;
      case 'referee':
        add('firstName', trim(form.firstName));
        add('lastName', trim(form.lastName));
        add('bio', trim(form.bio));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('careerHistory', trim(form.careerHistory));
        try {
          payload.contact = JSON.parse(form.contactJson || '{}');
        } catch {
          payload.contact = {};
        }
        break;
      case 'club':
        add('club', trim(form.club));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('bio', trim(form.bio));
        add('careerHistory', trim(form.careerHistory));
        try {
          payload.contact = JSON.parse(form.contactJson || '{}');
        } catch {
          payload.contact = {};
        }
        break;
      case 'federation':
        add('club', trim(form.club));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('bio', trim(form.bio));
        add('careerHistory', trim(form.careerHistory));
        try {
          payload.contact = JSON.parse(form.contactJson || '{}');
        } catch {
          payload.contact = {};
        }
        break;
      case 'business':
      case 'media': {
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('bio', trim(form.bio));
        payload.stats = {
          industry: trim(form.industry),
          founded: trim(form.founded),
          companySize: trim(form.companySize),
          revenue: trim(form.revenue),
          employees: trim(form.employees),
          partnerships: trim(form.partnerships),
          countries: trim(form.countries),
        };
        payload.contact = {
          phone: trim(form.phone),
          instagram: trim(form.instagram),
          twitter: trim(form.twitter),
          facebook: trim(form.facebook),
        };
        break;
      }
      default:
        add('firstName', trim(form.firstName));
        add('lastName', trim(form.lastName));
        add('dateOfBirth', trim(form.dateOfBirth));
        add('gender', form.gender);
        add('bio', trim(form.bio));
        add('city', trim(form.city));
        add('country', trim(form.country));
        add('club', trim(form.club));
        add('position', trim(form.position));
        break;
    }
    return payload;
  }, [editRole, form, profilePhotoFile]);

  const postClubSideEffects = async () => {
    const trimmedClub = form.club?.trim();
    if (!trimmedClub) return;
    if (editRole === 'athlete') {
      try {
        await clubMembersRequestMembership({
          clubId: form.selectedClubId || undefined,
          clubName: trimmedClub,
          position: form.position || undefined,
          jerseyNumber: form.jerseyNumber || undefined,
        });
      } catch (_e) {
        /* optional */
      }
      try {
        await submitClubRosterRequest({
          clubId: form.selectedClubId || undefined,
          position: form.position || undefined,
          jerseyNumber: form.jerseyNumber || undefined,
        });
      } catch (_e) {
        /* optional */
      }
    }
    if (editRole === 'coach') {
      try {
        await clubMembersRequestMembership({
          clubId: form.selectedClubId || undefined,
          clubName: trimmedClub,
        });
      } catch (_e) {
        /* optional */
      }
    }
  };

  const onSave = async () => {
    if (editRole === 'liga') return;
    setSaving(true);
    try {
      const payload = buildPayload();
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
      await postClubSideEffects();
      try {
        await refreshMe();
      } catch (_e) {
        /* tab avatar rifreskohet herën tjetër që /me kalon */
      }
      Alert.alert('Success', 'Profile updated successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Update failed', extractErrorMessage(err, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  const labelFor = (text) => <Text style={styles.label}>{text}</Text>;
  const input = (key, props = {}) => (
    <TextInput
      style={styles.input}
      value={form[key]}
      onChangeText={(v) => setField(key, v)}
      placeholderTextColor="#94a3b8"
      {...props}
    />
  );

  const pickerButton = (fieldKey, title, options, displayValue) => (
    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker(fieldKey, title, options)}>
      <Text style={styles.pickerBtnText}>{displayValue || title}</Text>
    </TouchableOpacity>
  );

  const genderDisplay = GENDER_OPTIONS.find((o) => o.value === form.gender)?.label || 'Select Gender';
  const positionDisplay = ATHLETE_POSITIONS.find((o) => o.value === form.position)?.label || 'Select Position';
  const footDisplay = PREFERRED_FOOT_OPTIONS.find((o) => o.value === form.preferredFoot)?.label || 'Right';
  const coachAffDisplay = COACH_AFFILIATIONS.find((o) => o.value === form.coachAffiliation)?.label || 'Select Affiliation';
  const coachCatDisplay = COACH_CATEGORIES.find((o) => o.value === form.coachCategory)?.label || 'Select Category';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (editRole === 'liga') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Profili i Ligës përditësohet nga platforma web (forma e veçantë për liga), jo nga ky ekran.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Kthehu</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.roleTag}>Role: {String(user?.role || '—')}</Text>

      {labelFor('Profile Photo')}
      <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
        <Text style={styles.secondaryButtonText}>{profilePhotoFile ? 'Change photo' : 'Choose photo'}</Text>
      </TouchableOpacity>
      {profilePhotoFile ? (
        <Image source={{ uri: profilePhotoFile.uri }} style={styles.avatarPreview} />
      ) : existingPhotoUrl ? (
        <Image source={{ uri: existingPhotoUrl }} style={styles.avatarPreview} />
      ) : null}

      {editRole === 'athlete' && (
        <>
          {labelFor('First Name *')}
          {input('firstName', { autoCapitalize: 'words' })}
          {labelFor('Last Name *')}
          {input('lastName', { autoCapitalize: 'words' })}
          {labelFor('Date of Birth')}
          {input('dateOfBirth', { placeholder: 'YYYY-MM-DD' })}
          {labelFor('Gender')}
          {pickerButton('gender', 'Gender', GENDER_OPTIONS, genderDisplay)}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline], maxLength: 500 })}
          {labelFor('Position')}
          {pickerButton('position', 'Position', ATHLETE_POSITIONS, positionDisplay)}
          {labelFor('Club')}
          {input('club', { placeholder: 'Shkruaj emrin e klubit', onChangeText: (v) => setForm((p) => ({ ...p, club: v, selectedClubId: null })) })}
          {clubSuggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              {clubSuggestions.map((club) => {
                const label = club.club || `${club.firstName || ''} ${club.lastName || ''}`.trim();
                const id = club.userId || club.id;
                return (
                  <TouchableOpacity
                    key={String(id)}
                    style={styles.suggestRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, club: label || p.club, selectedClubId: id }));
                      setClubSuggestions([]);
                    }}
                  >
                    <Text style={styles.suggestText}>{label || 'Club'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          {labelFor('Jersey Number')}
          {input('jerseyNumber', { keyboardType: 'number-pad' })}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Preferred Foot')}
          {pickerButton('preferredFoot', 'Preferred Foot', PREFERRED_FOOT_OPTIONS, footDisplay)}
          {labelFor('Height (cm)')}
          {input('height', { keyboardType: 'number-pad', placeholder: '175' })}
          {labelFor('Weight (kg)')}
          {input('weight', { keyboardType: 'number-pad', placeholder: '70' })}
        </>
      )}

      {editRole === 'coach' && (
        <>
          {labelFor('First Name *')}
          {input('firstName', { autoCapitalize: 'words' })}
          {labelFor('Last Name *')}
          {input('lastName', { autoCapitalize: 'words' })}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline], maxLength: 500 })}
          {labelFor('Club')}
          {input('club', { placeholder: 'Shkruaj emrin e klubit', onChangeText: (v) => setForm((p) => ({ ...p, club: v, selectedClubId: null })) })}
          {clubSuggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              {clubSuggestions.map((club) => {
                const label = club.club || `${club.firstName || ''} ${club.lastName || ''}`.trim();
                const id = club.userId || club.id;
                return (
                  <TouchableOpacity
                    key={String(id)}
                    style={styles.suggestRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, club: label || p.club, selectedClubId: id }));
                      setClubSuggestions([]);
                    }}
                  >
                    <Text style={styles.suggestText}>{label || 'Club'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          {labelFor('Affiliation')}
          {pickerButton('coachAffiliation', 'Affiliation', COACH_AFFILIATIONS, coachAffDisplay)}
          {labelFor('Category')}
          {pickerButton('coachCategory', 'Category', COACH_CATEGORIES, coachCatDisplay)}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Career History')}
          {input('careerHistory', { multiline: true, style: [styles.input, styles.multilineSmall] })}
        </>
      )}

      {(editRole === 'scout' || editRole === 'manager') && (
        <>
          {labelFor('First Name *')}
          {input('firstName')}
          {labelFor('Last Name *')}
          {input('lastName')}
          {labelFor('Club')}
          {input('club')}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline] })}
          {labelFor('Career History')}
          {input('careerHistory', { multiline: true, style: [styles.input, styles.multilineSmall] })}
          {labelFor('Contact (JSON)')}
          {input('contactJson', { multiline: true, style: [styles.input, styles.multiline], autoCapitalize: 'none' })}
        </>
      )}

      {editRole === 'referee' && (
        <>
          {labelFor('First Name *')}
          {input('firstName')}
          {labelFor('Last Name *')}
          {input('lastName')}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline], maxLength: 500 })}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Career History')}
          {input('careerHistory', { multiline: true, style: [styles.input, styles.multilineSmall] })}
          {labelFor('Contact (JSON)')}
          {input('contactJson', { multiline: true, style: [styles.input, styles.multiline], autoCapitalize: 'none' })}
        </>
      )}

      {editRole === 'club' && (
        <>
          {labelFor('Club Name')}
          {input('club')}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline] })}
          {labelFor('Career History')}
          {input('careerHistory', { multiline: true, style: [styles.input, styles.multilineSmall] })}
          {labelFor('Contact (JSON)')}
          {input('contactJson', { multiline: true, style: [styles.input, styles.multiline], autoCapitalize: 'none' })}
        </>
      )}

      {editRole === 'federation' && (
        <>
          {labelFor('Federation Name')}
          {input('club')}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline] })}
          {labelFor('Contact (JSON)')}
          {input('contactJson', { multiline: true, style: [styles.input, styles.multiline], autoCapitalize: 'none' })}
          {labelFor('Career History')}
          {input('careerHistory', { multiline: true, style: [styles.input, styles.multilineSmall] })}
        </>
      )}

      {(editRole === 'business' || editRole === 'media') && (
        <>
          {labelFor('Industry')}
          {input('industry')}
          {labelFor('Founded')}
          {input('founded')}
          {labelFor('Company Size')}
          {input('companySize')}
          {labelFor('Annual Revenue')}
          {input('revenue')}
          {labelFor('Employees')}
          {input('employees')}
          {labelFor('Partnerships')}
          {input('partnerships')}
          {labelFor('Countries')}
          {input('countries')}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline] })}
          {labelFor('Phone')}
          {input('phone', { keyboardType: 'phone-pad' })}
          {labelFor('Instagram')}
          {input('instagram', { autoCapitalize: 'none' })}
          {labelFor('Twitter')}
          {input('twitter', { autoCapitalize: 'none' })}
          {labelFor('Facebook')}
          {input('facebook', { autoCapitalize: 'none' })}
        </>
      )}

      {![
        'athlete',
        'coach',
        'scout',
        'manager',
        'referee',
        'club',
        'federation',
        'business',
        'media',
      ].includes(editRole) && (
        <>
          {labelFor('First name')}
          {input('firstName')}
          {labelFor('Last name')}
          {input('lastName')}
          {labelFor('Date of birth (YYYY-MM-DD)')}
          {input('dateOfBirth')}
          {labelFor('Gender')}
          {pickerButton('gender', 'Gender', GENDER_OPTIONS, genderDisplay)}
          {labelFor('Bio')}
          {input('bio', { multiline: true, style: [styles.input, styles.multiline] })}
          {labelFor('City')}
          {input('city')}
          {labelFor('Country')}
          {input('country')}
          {labelFor('Club')}
          {input('club')}
          {labelFor('Position')}
          {input('position')}
        </>
      )}

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save profile'}</Text>
      </TouchableOpacity>

      <OptionPickerModal
        visible={picker.open}
        title={picker.title}
        options={picker.options}
        field={picker.field}
        selectedValue={picker.field ? form[picker.field] : ''}
        onSelect={onPickerSelect}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 36 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  roleTag: { fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: '600' },
  hint: { color: '#334155', fontSize: 15, lineHeight: 22, marginBottom: 16 },
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
  pickerBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  pickerBtnText: { color: '#0f172a', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  secondaryButtonText: { color: '#0f766e', fontWeight: '700' },
  avatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 64, textAlignVertical: 'top' },
  suggestBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    maxHeight: 160,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  suggestRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestText: { fontSize: 14, color: '#0f172a' },
  button: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '70%',
    paddingVertical: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', paddingHorizontal: 16, paddingBottom: 8, color: '#0f172a' },
  modalList: { maxHeight: 360 },
  modalRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalRowActive: { backgroundColor: '#ecfdf5' },
  modalRowText: { fontSize: 15, color: '#0f172a' },
});
