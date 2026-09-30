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
} from '../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import {
  extractErrorMessage,
  updateMyProfileRequest,
  youtubeResolveChannelRequest,
  deleteMyAccountRequest,
  openPrioritySupportChatRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { needsYoutubeResolve, normalizeYoutubeChannelId } from '../utils/youtubeChannel';
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermissionGranted,
  getPushPreference,
} from '../notifications/push';
import { WEB_APP_URL } from '../config/constants';
import { hasTier } from '../utils/subscriptionAccess';
import {
  PROFILE_THEMES,
  EARLY_ACCESS_FEATURES,
  loadEarlyAccessPrefs,
  saveEarlyAccessPrefs,
  prioritySupportMailto,
} from '../utils/profileThemes';

const YOUTUBE_STUDIO_HELP = 'https://www.youtube.com/account_advanced';
const WEB_BASE = (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');
const HELP_URL = `${WEB_BASE}/help`;
const ABOUT_URL = `${WEB_BASE}/about`;
const COMMUNITY_GUIDELINES_URL = `${WEB_BASE}/community-guidelines`;
const PRIVACY_URL = `${WEB_BASE}/privacy`;
const TERMS_URL = `${WEB_BASE}/terms`;
const COOKIES_URL = `${WEB_BASE}/cookies`;
const DATA_URL = `${WEB_BASE}/data`;

function profileFromUser(user) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    bio: user?.Profile?.bio || '',
    city: user?.Profile?.city || '',
    country: user?.Profile?.country || '',
    youtubeChannelId: user?.Profile?.youtubeChannelId || user?.youtubeChannelId || '',
    profileTheme: user?.Profile?.profileTheme || 'default',
  };
}

export default function SettingsScreen() {
  const { user, refreshMe, logout } = useAuth();
  const navigation = useNavigation();
  const { colors, isDark, preference, setPreference, setDarkMode, darkModeEnabled } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [resolvingYoutube, setResolvingYoutube] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const resolveSkipRef = useRef(false);
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [profileTheme, setProfileTheme] = useState(
    () => user?.Profile?.profileTheme || 'default'
  );
  const [labs, setLabs] = useState({});
  const isPro = hasTier(user, 'pro');

  useEffect(() => {
    setProfile(profileFromUser(user));
    setProfileTheme(user?.Profile?.profileTheme || 'default');
  }, [user]);

  useEffect(() => {
    loadEarlyAccessPrefs().then(setLabs).catch(() => {});
  }, []);

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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgElevated }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Dark mode</Text>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkMode}
            trackColor={{ false: colors.borderStrong, true: isDark ? '#115e59' : '#99f6e4' }}
            thumbColor={darkModeEnabled ? (isDark ? '#D9A441' : '#9A6B12') : '#f8fafc'}
          />
        </View>
        <TouchableOpacity
          onPress={() => setPreference('system')}
          style={styles.systemBtn}
          accessibilityRole="button"
          accessibilityLabel="Follow system appearance"
        >
          <Text style={[styles.systemBtnText, { color: colors.primary }]}>
            {preference === 'system' ? 'Duke ndjekur sistemin ✓' : 'Ndjek pamjen e sistemit'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.hint, { color: colors.mutedSoft }]}>
          Dark mode vlen për tab-in, header-at dhe ekranet e përshtatura. Disa module përditësohen gradualisht.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Enable notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            disabled={pushBusy}
            trackColor={{ false: colors.borderStrong, true: isDark ? '#115e59' : '#99f6e4' }}
            thumbColor={notificationsEnabled ? (isDark ? '#D9A441' : '#9A6B12') : '#f8fafc'}
          />
        </View>
        <Text style={[styles.hint, { color: colors.mutedSoft }]}>
          Njoftime push për like, komente, ndjekje, thirrje. Kërkon build me njoftime (jo Expo Go).
        </Text>
      </View>

      <View
        style={[
          styles.card,
          styles.youtubeCard,
          {
            backgroundColor: isDark ? '#1c0a0a' : '#fffbfb',
            borderColor: colors.dangerBorder,
          },
        ]}
      >
        <View style={styles.youtubeHeader}>
          <Ionicons name="logo-youtube" size={22} color="#dc2626" />
          <Text style={[styles.title, { color: colors.text }]}>YouTube Live</Text>
        </View>
        <Text style={[styles.youtubeLead, { color: colors.muted }]}>
          Për Go Live me OBS ose YouTube Studio — shikuesit në app shohin live-in të kanalit tënd.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Çfarë të vendosësh këtu</Text>
        <Text style={[styles.bullet, { color: colors.muted }]}>
          • <Text style={[styles.mono, { color: colors.primary }]}>Channel ID</Text> — fillon me{' '}
          <Text style={[styles.mono, { color: colors.primary }]}>UC</Text> (~24 shkronja gjithsej, jo 22)
        </Text>
        <Text style={[styles.bullet, { color: colors.muted }]}>
          • Ose linku @emri / Share → shtyp «Gjej ID nga linku»
        </Text>
        <Text style={[styles.bullet, { color: colors.muted }]}>
          • <Text style={styles.bold}>Jo</Text> video ID, jo stream key OBS
        </Text>

        <Text style={[styles.fieldLabel, styles.fieldLabelTop, { color: colors.text }]}>Ku e gjen në YouTube</Text>
        <Text style={[styles.step, { color: colors.muted }]}>1. Hap YouTube → avatar → Settings → Advanced settings</Text>
        <Text style={[styles.step, { color: colors.muted }]}>2. Kopjo “YouTube channel ID” (UC…)</Text>
        <Text style={[styles.step, { color: colors.muted }]}>3. Ngjite më poshtë dhe shtyp Ruaj</Text>

        <TouchableOpacity onPress={openYoutubeHelp} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Hap Advanced settings në YouTube</Text>
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
          style={[
            styles.input,
            styles.monoInput,
            { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={profile.youtubeChannelId}
          onChangeText={(v) => setProfile((p) => ({ ...p, youtubeChannelId: v }))}
          placeholder="UCflsCrcGKQ85RYdNM5oW27w ose link @emri"
          placeholderTextColor={colors.mutedSoft}
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
          <Text style={[styles.hint, { color: colors.mutedSoft }]}>
            Lëre bosh nëse përdor vetëm LiveKit (kamera në app).
          </Text>
        )}

        <Text style={[styles.obsNote, { color: colors.muted }]}>
          Stream key nga YouTube Studio përdoret vetëm në OBS — nuk vendoset këtu.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={profile.firstName}
          onChangeText={(v) => setProfile((p) => ({ ...p, firstName: v }))}
          placeholder="First name"
          placeholderTextColor={colors.mutedSoft}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={profile.lastName}
          onChangeText={(v) => setProfile((p) => ({ ...p, lastName: v }))}
          placeholder="Last name"
          placeholderTextColor={colors.mutedSoft}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={profile.bio}
          onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))}
          placeholder="Bio"
          placeholderTextColor={colors.mutedSoft}
          multiline
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={profile.city}
          onChangeText={(v) => setProfile((p) => ({ ...p, city: v }))}
          placeholder="City"
          placeholderTextColor={colors.mutedSoft}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={profile.country}
          onChangeText={(v) => setProfile((p) => ({ ...p, country: v }))}
          placeholder="Country"
          placeholderTextColor={colors.mutedSoft}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Duke ruajtur…' : 'Ruaj cilësimet'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Përfitime Pro</Text>
        <Text style={[styles.hint, { color: colors.mutedSoft }]}>
          {isPro
            ? 'Tema, Labs dhe suport prioritar.'
            : 'Aktivizo Pro për tema, akses të hershëm dhe suport prioritar.'}
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 10 }]}>Tema e profilit</Text>
        <View style={styles.themeRow}>
          {PROFILE_THEMES.map((t) => {
            const selected = profileTheme === t.id;
            const locked = !isPro && t.id !== 'default';
            return (
              <TouchableOpacity
                key={t.id}
                disabled={locked || saving}
                onPress={async () => {
                  if (locked) {
                    Alert.alert('Pro', 'Temat e personalizuara kërkojnë planin Pro.');
                    return;
                  }
                  setSaving(true);
                  try {
                    await updateMyProfileRequest({ profileTheme: t.id });
                    setProfileTheme(t.id);
                    await refreshMe?.();
                  } catch (err) {
                    Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u ruajt tema'));
                  } finally {
                    setSaving(false);
                  }
                }}
                style={[
                  styles.themeChip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft || colors.card : colors.card,
                    opacity: locked ? 0.45 : 1,
                  },
                ]}
              >
                <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
                <Text style={[styles.themeChipText, { color: colors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 14 }]}>
          Akses i hershëm (Labs)
        </Text>
        {EARLY_ACCESS_FEATURES.map((f) => (
          <View key={f.id} style={styles.labRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.labTitle, { color: colors.text }]}>{f.label}</Text>
              <Text style={[styles.hint, { color: colors.mutedSoft }]}>{f.description}</Text>
            </View>
            <Switch
              value={Boolean(labs[f.id])}
              disabled={!isPro}
              onValueChange={async (next) => {
                const updated = { ...labs, [f.id]: next };
                setLabs(updated);
                await saveEarlyAccessPrefs(updated);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.linkBtn, { marginTop: 8 }]}
          onPress={async () => {
            if (!isPro) {
              Alert.alert('Pro', 'Suporti prioritar është për anëtarët Pro.');
              return;
            }
            try {
              const res = await openPrioritySupportChatRequest();
              const conversationId = res?.data?.conversationId || res?.data?.conversation?.id;
              if (!conversationId) throw new Error('Biseda nuk u krijua');
              const params = {
                conversationId,
                title: res?.data?.teamName || 'X Talenti Team',
              };
              const parent = navigation.getParent?.();
              if (parent?.navigate) {
                parent.navigate('Messages', { screen: 'Conversation', params });
              } else {
                navigation.navigate('Messages', { screen: 'Conversation', params });
              }
            } catch (err) {
              const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
              Alert.alert(
                'Support',
                extractErrorMessage(err, 'Nuk u hap chat. Mund të përdorësh email.'),
                [
                  {
                    text: 'Email',
                    onPress: () =>
                      Linking.openURL(
                        prioritySupportMailto({
                          userId: user?.id,
                          name,
                          email: user?.email,
                        })
                      ),
                  },
                  { text: 'OK', style: 'cancel' },
                ]
              );
            }
          }}
        >
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>
            {isPro ? 'Chat me X Talenti Team' : 'Suport prioritar (kërkon Pro)'}
          </Text>
        </TouchableOpacity>
        {isPro ? (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => {
              const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
              Linking.openURL(
                prioritySupportMailto({ userId: user?.id, name, email: user?.email })
              );
            }}
          >
            <Text style={[styles.linkBtnText, { color: colors.primary }]}>Email prioritar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ndihmë, info & ligjore</Text>
        <TouchableOpacity onPress={() => openExternal(HELP_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Ndihmë & FAQ</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(ABOUT_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Rreth X TALENTI</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(COMMUNITY_GUIDELINES_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Udhëzuesit e komunitetit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(PRIVACY_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Politika e privatësisë</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(TERMS_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Kushtet e përdorimit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(COOKIES_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Politika e cookies</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal(DATA_URL)} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Të dhënat e tua (akses / fshirje)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:support@xtalenti.com')}
          style={styles.linkBtn}
        >
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>support@xtalenti.com</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Llogaria</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Dil', 'Dal nga llogaria?', [
              { text: 'Anulo', style: 'cancel' },
              { text: 'Dil', style: 'destructive', onPress: () => logout() },
            ]);
          }}
        >
          <Text style={styles.logoutButtonText}>Dil nga llogaria</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          styles.dangerCard,
          { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Fshi llogarinë</Text>
        <Text style={[styles.hint, { color: colors.mutedSoft }]}>
          Anonimizohen të dhënat personale. Transaksionet financiare ruhen sipas ligjit. Ky veprim nuk kthehet.
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={deletePassword}
          onChangeText={setDeletePassword}
          placeholder="Fjalëkalimi yt"
          placeholderTextColor={colors.mutedSoft}
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
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  themeChipText: { fontSize: 12, fontWeight: '700' },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  labTitle: { fontSize: 14, fontWeight: '700' },
  bullet: { color: '#475569', fontSize: 13, lineHeight: 19, marginBottom: 2 },
  step: { color: '#64748b', fontSize: 13, lineHeight: 19, marginBottom: 2 },
  mono: { fontFamily: 'Menlo', fontSize: 12, color: '#9A6B12' },
  bold: { fontWeight: '700' },
  hint: { color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 16 },
  okHint: { color: '#9A6B12', fontSize: 12, marginTop: 6, fontWeight: '600' },
  pendingHint: { color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: '600' },
  errHint: { color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: '600' },
  obsNote: { color: '#64748b', fontSize: 11, marginTop: 8, fontStyle: 'italic', lineHeight: 15 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemBtn: { marginTop: 10, alignSelf: 'flex-start' },
  systemBtnText: { fontWeight: '700', fontSize: 13 },
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
  linkBtnText: { color: '#9A6B12', fontWeight: '600', fontSize: 13 },
  resolveBtn: {
    marginBottom: 10,
    backgroundColor: '#9A6B12',
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
  logoutButton: {
    marginTop: 4,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutButtonText: { color: '#fff', fontWeight: '800' },
  saveButton: {
    marginTop: 6,
    backgroundColor: '#9A6B12',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
