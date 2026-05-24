import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { extractErrorMessage, updateMyProfileRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { normalizeYoutubeChannelId } from '../utils/youtubeChannel';

const YOUTUBE_STUDIO_HELP = 'https://www.youtube.com/account_advanced';

function profileFromUser(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.Profile?.bio || '',
    city: user?.Profile?.city || '',
    country: user?.Profile?.country || '',
    youtubeChannelId: user?.Profile?.youtubeChannelId || user?.youtubeChannelId || '',
  };
}

export default function SettingsScreen() {
  const { user, refreshMe } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(() => profileFromUser(user));

  useEffect(() => {
    setProfile(profileFromUser(user));
  }, [user]);

  const normalizedYoutube = useMemo(
    () => normalizeYoutubeChannelId(profile.youtubeChannelId),
    [profile.youtubeChannelId]
  );

  const handleSave = async () => {
    const yt = String(profile.youtubeChannelId || '').trim();
    if (yt && !normalizeYoutubeChannelId(yt)) {
      Alert.alert(
        'YouTube ID jo valid',
        'Vendos vetëm Channel ID (UC + 22 shkronja) ose linkun e plotë youtube.com/channel/UC…'
      );
      return;
    }
    setSaving(true);
    try {
      await updateMyProfileRequest({
        ...profile,
        youtubeChannelId: yt,
      });
      await refreshMe();
      Alert.alert('U ruajt', 'Cilësimet u përditësuan.');
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u ruajt profili'));
    } finally {
      setSaving(false);
    }
  };

  const openYoutubeHelp = () => {
    Linking.openURL(YOUTUBE_STUDIO_HELP).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Appearance</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Dark mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
        <Text style={styles.hint}>Dark mode në mobile vjen në një përditësim të ardhshëm.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable notifications</Text>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
        </View>
        <Text style={styles.hint}>Njoftimet push kërkojnë build me expo-notifications.</Text>
      </View>

      <View style={[styles.card, styles.youtubeCard]}>
        <View style={styles.youtubeHeader}>
          <Ionicons name="logo-youtube" size={22} color="#dc2626" />
          <Text style={styles.title}>YouTube Live</Text>
        </View>
        <Text style={styles.youtubeLead}>
          Për Go Live me OBS ose YouTube Studio — shikuesit në app shohin live-in të kanalit tënd.
        </Text>

        <Text style={styles.fieldLabel}>Çfarë të vendosësh këtu</Text>
        <Text style={styles.bullet}>• Vetëm <Text style={styles.mono}>Channel ID</Text> — fillon me UC (24 karaktere gjithsej)</Text>
        <Text style={styles.bullet}>• Ose linku: youtube.com/channel/UC…</Text>
        <Text style={styles.bullet}>• <Text style={styles.bold}>Jo</Text> emri i kanalit, jo video ID, jo stream key nga OBS</Text>

        <Text style={[styles.fieldLabel, styles.fieldLabelTop]}>Ku e gjen në YouTube</Text>
        <Text style={styles.step}>1. Hap YouTube → avatar → Settings → Advanced settings</Text>
        <Text style={styles.step}>2. Kopjo “YouTube channel ID” (UC…)</Text>
        <Text style={styles.step}>3. Ngjite më poshtë dhe shtyp Ruaj</Text>

        <TouchableOpacity onPress={openYoutubeHelp} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Hap Advanced settings në YouTube</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, styles.monoInput]}
          value={profile.youtubeChannelId}
          onChangeText={(v) => setProfile((p) => ({ ...p, youtubeChannelId: v }))}
          placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {profile.youtubeChannelId?.trim() ? (
          normalizedYoutube ? (
            <Text style={styles.okHint}>✓ ID valid: {normalizedYoutube}</Text>
          ) : (
            <Text style={styles.errHint}>Format i gabuar — duhet UC + 22 karaktere</Text>
          )
        ) : (
          <Text style={styles.hint}>Lëre bosh nëse përdor vetëm LiveKit (kamera në app).</Text>
        )}

        <Text style={styles.obsNote}>
          Stream key nga YouTube Studio përdoret vetëm në OBS — nuk vendoset këtu.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <TextInput
          style={styles.input}
          value={profile.firstName}
          onChangeText={(v) => setProfile((p) => ({ ...p, firstName: v }))}
          placeholder="First name"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          value={profile.lastName}
          onChangeText={(v) => setProfile((p) => ({ ...p, lastName: v }))}
          placeholder="Last name"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          value={profile.bio}
          onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))}
          placeholder="Bio"
          placeholderTextColor="#94a3b8"
          multiline
        />
        <TextInput
          style={styles.input}
          value={profile.city}
          onChangeText={(v) => setProfile((p) => ({ ...p, city: v }))}
          placeholder="City"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          value={profile.country}
          onChangeText={(v) => setProfile((p) => ({ ...p, country: v }))}
          placeholder="Country"
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Duke ruajtur…' : 'Ruaj cilësimet'}</Text>
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
  youtubeCard: { borderColor: '#fecaca', backgroundColor: '#fffbfb' },
  youtubeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  youtubeLead: { color: '#475569', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  title: { color: '#0f172a', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  label: { color: '#334155' },
  fieldLabel: { color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  fieldLabelTop: { marginTop: 8 },
  bullet: { color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: 2 },
  step: { color: '#64748b', fontSize: 13, lineHeight: 19, marginBottom: 2 },
  mono: { fontFamily: 'Menlo', fontSize: 12, color: '#0f766e' },
  bold: { fontWeight: '700' },
  hint: { color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 16 },
  okHint: { color: '#0f766e', fontSize: 12, marginTop: 6, fontWeight: '600' },
  errHint: { color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: '600' },
  obsNote: { color: '#64748b', fontSize: 11, marginTop: 8, fontStyle: 'italic', lineHeight: 15 },
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
  monoInput: { fontFamily: 'Menlo', fontSize: 13 },
  linkBtn: { marginVertical: 8 },
  linkBtnText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
  saveButton: {
    marginTop: 6,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
