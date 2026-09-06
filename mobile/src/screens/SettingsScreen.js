import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  extractErrorMessage,
  updateMyProfileRequest,
  youtubeResolveChannelRequest,
  deleteMyAccountRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { needsYoutubeResolve, normalizeYoutubeChannelId } from '../utils/youtubeChannel';
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermissionGranted,
  getPushPreference,
} from '../notifications/push';
import { WEB_APP_URL } from '../config/constants';

const YOUTUBE_STUDIO_HELP = 'https://www.youtube.com/account_advanced';
const COMMUNITY_GUIDELINES_URL = `${(WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '')}/community-guidelines`;
const PRIVACY_URL = `${(WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '')}/privacy`;
const TERMS_URL = `${(WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '')}/terms`;

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
  const { user, refreshMe, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [resolvingYoutube, setResolvingYoutube] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const resolveSkipRef = useRef(false);
  const [profile, setProfile] = useState(() => profileFromUser(user));

  useEffect(() => {
    setProfile(profileFromUser(user));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pref = await getPushPreference();
        const granted = await getNotificationPermissionGranted();
        if (!cancelled) setNotificationsEnabled(Boolean(pref && granted));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotificationsToggle = async (next) => {
    setPushBusy(true);
    setNotificationsEnabled(next);
    try {
      if (next) {
        const token = await enablePushNotifications();
        if (!token) {
          setNotificationsEnabled(false);
          Alert.alert(
            'Njoftimet',
            'Lejo njoftimet nga Settings e telefonit, pastaj provo përsëri. Në simulator push nuk funksionon.'
          );
        }
      } else {
        await disablePushNotifications();
      }
    } catch (err) {
      setNotificationsEnabled(!next);
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u përditësuan njoftimet'));
    } finally {
      setPushBusy(false);
    }
  };

  const normalizedYoutube = useMemo(
    () => normalizeYoutubeChannelId(profile.youtubeChannelId),
    [profile.youtubeChannelId]
  );

  const resolveYoutubeFromInput = async (raw, { silent } = { silent: false }) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      setResolveError('');
      return null;
    }
    const existing = normalizeYoutubeChannelId(trimmed);
    if (existing) {
      setResolveError('');
      if (trimmed !== existing) {
        resolveSkipRef.current = true;
        setProfile((p) => ({ ...p, youtubeChannelId: existing }));
      }
      return existing;
    }
    if (!needsYoutubeResolve(trimmed)) {
      setResolveError('Format i panjohur — përdor linkun nga YouTube Share.');
      return null;
    }

    setResolvingYoutube(true);
    setResolveError('');
    try {
      const res = await youtubeResolveChannelRequest(trimmed);
      const id = res.data?.channelId || null;
      if (!id) {
        setResolveError('Nuk u gjet kanali. Kontrollo emrin @ ose lidhu me internet.');
        if (!silent) Alert.alert('Nuk u gjet', 'Kontrollo që ke kanal publik dhe linkun e saktë nga Share.');
        return null;
      }
      resolveSkipRef.current = true;
      setProfile((p) => ({ ...p, youtubeChannelId: id }));
      setResolveError('');
      if (!silent) Alert.alert('U gjet ID', id);
      return id;
    } catch (err) {
      const msg = extractErrorMessage(err, 'Nuk u gjet Channel ID');
      setResolveError(msg);
      if (!silent) Alert.alert('Gabim', msg);
      return null;
    } finally {
      setResolvingYoutube(false);
    }
  };

  useEffect(() => {
    const raw = String(profile.youtubeChannelId || '').trim();
    if (!raw || normalizeYoutubeChannelId(raw)) {
      setResolveError('');
      return undefined;
    }
    if (!needsYoutubeResolve(raw)) return undefined;
    if (resolveSkipRef.current) {
      resolveSkipRef.current = false;
      return undefined;
    }

    const timer = setTimeout(() => {
      resolveYoutubeFromInput(raw, { silent: true });
    }, 700);
    return () => clearTimeout(timer);
  }, [profile.youtubeChannelId]);

  const handleResolveYoutube = () => resolveYoutubeFromInput(profile.youtubeChannelId, { silent: false });

  const handleSave = async () => {
    let yt = String(profile.youtubeChannelId || '').trim();
    let ytNorm = normalizeYoutubeChannelId(yt);

    if (yt && !ytNorm && needsYoutubeResolve(yt)) {
      ytNorm = await resolveYoutubeFromInput(yt, { silent: true });
      if (ytNorm) yt = ytNorm;
    }

    if (yt && !ytNorm) {
      setSaving(false);
      Alert.alert(
        'YouTube ID jo valid',
        needsYoutubeResolve(yt)
          ? 'Ngjit linkun nga Share (@emri) dhe shtyp «Gjej ID nga linku», pastaj Ruaj.'
          : 'Duhet ID që fillon me UC (~24 karaktere). Shembull: UCflsCrcGKQ85RYdNM5oW27w'
      );
      return;
    }

    setSaving(true);
    try {
      await updateMyProfileRequest({
        ...profile,
        youtubeChannelId: ytNorm || '',
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

  const openExternal = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Gabim', 'Nuk u hap lidhja'));
  };

  const runDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert('Fjalëkalimi', 'Vendos fjalëkalimin për të fshirë llogarinë.');
      return;
    }
    Alert.alert(
      'Fshi llogarinë?',
      'Të dhënat personale anonimizohen. Kjo nuk kthehet.',
      [
        { text: 'Anulo', style: 'cancel' },
        {
          text: 'Fshi',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccountRequest({
                password: deletePassword,
                confirm: 'DELETE',
              });
              Alert.alert('Llogaria u fshi', 'Mirupafshim.');
              await logout();
            } catch (err) {
              Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u fshi llogaria'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
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
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            disabled={pushBusy}
          />
        </View>
        <Text style={styles.hint}>
          Njoftime push për like, komente, ndjekje, thirrje. Kërkon build me njoftime (jo Expo Go).
        </Text>
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
        <Text style={styles.bullet}>
          • <Text style={styles.mono}>Channel ID</Text> — fillon me <Text style={styles.mono}>UC</Text> (~24 shkronja
          gjithsej, jo 22)
        </Text>
        <Text style={styles.bullet}>• Ose linku @emri / Share → shtyp «Gjej ID nga linku»</Text>
        <Text style={styles.bullet}>• <Text style={styles.bold}>Jo</Text> video ID, jo stream key OBS</Text>

        <Text style={[styles.fieldLabel, styles.fieldLabelTop]}>Ku e gjen në YouTube</Text>
        <Text style={styles.step}>1. Hap YouTube → avatar → Settings → Advanced settings</Text>
        <Text style={styles.step}>2. Kopjo “YouTube channel ID” (UC…)</Text>
        <Text style={styles.step}>3. Ngjite më poshtë dhe shtyp Ruaj</Text>

        <TouchableOpacity onPress={openYoutubeHelp} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Hap Advanced settings në YouTube</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResolveYoutube}
          disabled={resolvingYoutube}
          style={[styles.resolveBtn, resolvingYoutube && styles.resolveBtnDisabled]}
        >
          <Text style={styles.resolveBtnText}>
            {resolvingYoutube ? 'Duke kërkuar ID…' : 'Gjej ID nga linku (@ ose Share)'}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, styles.monoInput]}
          value={profile.youtubeChannelId}
          onChangeText={(v) => setProfile((p) => ({ ...p, youtubeChannelId: v }))}
          placeholder="UCflsCrcGKQ85RYdNM5oW27w ose link @emri"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {profile.youtubeChannelId?.trim() ? (
          resolvingYoutube ? (
            <Text style={styles.pendingHint}>Duke gjetur Channel ID nga linku…</Text>
          ) : normalizedYoutube ? (
            <Text style={styles.okHint}>✓ ID valid: {normalizedYoutube}</Text>
          ) : resolveError ? (
            <Text style={styles.errHint}>{resolveError}</Text>
          ) : needsYoutubeResolve(profile.youtubeChannelId) ? (
            <Text style={styles.pendingHint}>
              Link @ i saktë — shtyp butonin e gjelbër ose prit pak sekonda…
            </Text>
          ) : (
            <Text style={styles.errHint}>
              Jo valid — duhet UC… (~24 karaktere) ose link @ nga Share
            </Text>
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

      <View style={styles.card}>
        <Text style={styles.title}>Ligjore & komuniteti</Text>
        <TouchableOpacity onPress={() => openExternal(COMMUNITY_GUIDELINES_URL)} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Udhëzuesit e komunitetit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(PRIVACY_URL)} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Politika e privatësisë</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(TERMS_URL)} style={styles.linkBtn}>
          <Text style={styles.linkBtnText}>Kushtet e përdorimit</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.title}>Fshi llogarinë</Text>
        <Text style={styles.hint}>
          Anonimizohen të dhënat personale. Transaksionet financiare ruhen sipas ligjit. Ky veprim nuk kthehet.
        </Text>
        <TextInput
          style={styles.input}
          value={deletePassword}
          onChangeText={setDeletePassword}
          placeholder="Fjalëkalimi yt"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={runDeleteAccount}
          disabled={deleting}
        >
          <Text style={styles.dangerButtonText}>{deleting ? 'Duke fshirë…' : 'Fshi llogarinë time'}</Text>
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
  dangerCard: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
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
  pendingHint: { color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: '600' },
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
  resolveBtn: {
    marginBottom: 10,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  resolveBtnDisabled: { opacity: 0.6 },
  resolveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dangerButton: {
    marginTop: 8,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  dangerButtonText: { color: '#fff', fontWeight: '800' },
  saveButton: {
    marginTop: 6,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
