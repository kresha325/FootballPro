import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import {
  adminCreateManagedAthleteRequest,
  adminVerifiedClubsRequest,
  clubStaffAssignmentsRequest,
  createManagedAthleteRequest,
  extractErrorMessage,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';

const STAFF_ROLES = new Set(['head_coach', 'assistant_coach', 'fitness_coach', 'goalkeeper_coach', 'technical_coach', 'tactical_coach', 'academy_director', 'youth_director']);
const CATEGORIES = ['open', 'senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u10', 'u9'];
const TEAM_TYPES = ['first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'];
function isMinor(date) {
  if (!date) return false;
  const dob = new Date(`${date}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return Number.isFinite(dob.getTime()) && age < 18;
}

export default function ManagedAthleteRegistrationForm({ mode = 'club', onSuccess }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState('');
  const [clubPicker, setClubPicker] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(mode !== 'club');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', teamType: '', competitionCategory: 'open', squadGroup: '', position: '', jerseyNumber: '', parentEmail: '' });
  const minor = useMemo(() => isMinor(form.dateOfBirth), [form.dateOfBirth]);

  useEffect(() => {
    if (mode === 'club') return undefined;
    let cancelled = false;
    setLoadingClubs(true);
    const load = mode === 'admin'
      ? adminVerifiedClubsRequest({ limit: 100 }).then((res) => (res.data?.rows || [])
        .filter((club) => club.adminVerified && !club.suspended)
        .map((club) => ({ id: club.id, name: club.name })))
      : clubStaffAssignmentsRequest(user?.id).then((res) => (Array.isArray(res.data) ? res.data : [])
        .filter((row) => row.status === 'active' && !row.leftAt && STAFF_ROLES.has(String(row.staffRole || '').toLowerCase()))
        .filter((row) => row.club?.adminVerified && !row.club?.bannedAt && !row.club?.deletedAt)
        .filter((row) => !row.contractUntil || (Number.isFinite(new Date(row.contractUntil).getTime()) && new Date(row.contractUntil) >= new Date()))
        .map((row) => ({ id: row.clubId, name: row.club?.Profile?.club || [row.club?.firstName, row.club?.lastName].filter(Boolean).join(' ') || `Klubi #${row.clubId}` })));
    load.then((rows) => {
      if (cancelled) return;
      const unique = [...new Map(rows.map((row) => [String(row.id), row])).values()];
      setClubs(unique);
      if (unique.length === 1) setClubId(String(unique[0].id));
    }).catch((err) => { if (!cancelled) setError(extractErrorMessage(err, 'Nuk u ngarkuan klubet e autorizuara.')); })
      .finally(() => { if (!cancelled) setLoadingClubs(false); });
    return () => { cancelled = true; };
  }, [mode, user?.id]);

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async () => {
    setError('');
    setSuccess('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth || (minor && !form.parentEmail.trim())) {
      setError('Plotëso emrin, mbiemrin, datëlindjen dhe email-in e kujdestarit për të miturin.');
      return;
    }
    if (mode !== 'club' && !clubId) {
      setError('Zgjidh klubin.');
      return;
    }
    setSaving(true);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth,
      teamType: form.teamType || undefined,
      competitionCategory: form.competitionCategory,
      squadGroup: form.squadGroup || undefined,
      position: form.position || undefined,
      jerseyNumber: form.jerseyNumber || undefined,
      parentEmail: minor ? form.parentEmail : undefined,
    };
    if (mode !== 'club') payload.clubId = Number(clubId);
    try {
      const response = mode === 'admin'
        ? await adminCreateManagedAthleteRequest(payload)
        : await createManagedAthleteRequest(payload);
      setSuccess(response.data?.msg || 'Atleti u regjistrua.');
      setForm({ firstName: '', lastName: '', dateOfBirth: '', teamType: '', competitionCategory: 'open', squadGroup: '', position: '', jerseyNumber: '', parentEmail: '' });
      onSuccess?.(response.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Regjistrimi dështoi.'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }];
  const labelStyle = [styles.label, { color: colors.text }];
  const buttonStyle = [styles.button, { backgroundColor: colors.primary }];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('Regjistro atlet')}</Text>
      <Text style={[styles.help, { color: colors.muted }]}>Krijohet pa fjalëkalim ose kredenciale hyrjeje.</Text>
      {mode !== 'club' ? (
        <>
          <Text style={labelStyle}>{t('Klubi')}</Text>
          <TouchableOpacity style={[inputStyle, styles.select]} onPress={() => setClubPicker(true)} disabled={loadingClubs || saving}>
            <Text style={{ color: clubId ? colors.text : colors.muted }}>{clubs.find((item) => String(item.id) === String(clubId))?.name || (loadingClubs ? t('Duke ngarkuar…') : t('Zgjidh klubin'))}</Text>
          </TouchableOpacity>
          <Modal visible={clubPicker} transparent animationType="fade" onRequestClose={() => setClubPicker(false)}>
            <View style={styles.modalShade}>
              <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.title, { color: colors.text }]}>{t('Zgjidh klubin')}</Text>
                <FlatList data={clubs} keyExtractor={(item) => String(item.id)} ListEmptyComponent={<Text style={{ color: colors.muted }}>Nuk ka klube të autorizuara.</Text>} renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.clubOption, { borderBottomColor: colors.border }]} onPress={() => { setClubId(String(item.id)); setClubPicker(false); }}>
                    <Text style={{ color: colors.text }}>{item.name}</Text>
                  </TouchableOpacity>
                )} />
                <TouchableOpacity style={[buttonStyle, { marginTop: 10 }]} onPress={() => setClubPicker(false)}><Text style={styles.buttonText}>{t('Mbyll')}</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      <View style={styles.grid}>
        <View style={styles.field}><Text style={labelStyle}>{t('Emri')}</Text><TextInput value={form.firstName} onChangeText={setField('firstName')} style={inputStyle} maxLength={100} autoComplete="given-name" /></View>
        <View style={styles.field}><Text style={labelStyle}>{t('Mbiemri')}</Text><TextInput value={form.lastName} onChangeText={setField('lastName')} style={inputStyle} maxLength={100} autoComplete="family-name" /></View>
        <View style={styles.field}><Text style={labelStyle}>{t('Datëlindja')}</Text><TextInput value={form.dateOfBirth} onChangeText={setField('dateOfBirth')} style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} maxLength={10} /></View>
        <View style={styles.field}>
          <Text style={labelStyle}>{t('Ekipi')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={[styles.chip, { borderColor: colors.border, backgroundColor: !form.teamType ? colors.primary : colors.bgElevated }]} onPress={() => setField('teamType')('')}><Text style={{ color: !form.teamType ? colors.onPrimary : colors.text }}>{t('Automatikisht')}</Text></TouchableOpacity>
            {TEAM_TYPES.map((team) => <TouchableOpacity key={team} style={[styles.chip, { borderColor: colors.border, backgroundColor: form.teamType === team ? colors.primary : colors.bgElevated }]} onPress={() => setField('teamType')(team)}><Text style={{ color: form.teamType === team ? colors.onPrimary : colors.text }}>{t(team.replaceAll('_', ' '))}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>
        <View style={styles.field}>
          <Text style={labelStyle}>{t('Grupmosha / kategoria e garës')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((category) => <TouchableOpacity key={category} style={[styles.chip, { borderColor: colors.border, backgroundColor: form.competitionCategory === category ? colors.primary : colors.bgElevated }]} onPress={() => setForm((prev) => ({ ...prev, competitionCategory: category, squadGroup: category.startsWith('u') ? prev.squadGroup : '' }))}><Text style={{ color: form.competitionCategory === category ? colors.onPrimary : colors.text }}>{category.toUpperCase()}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>
        {form.competitionCategory.startsWith('u') ? <View style={styles.field}><Text style={labelStyle}>{t('Grupi A/B/C')}</Text><View style={styles.row}>{['A', 'B', 'C'].map((group) => <TouchableOpacity key={group} style={[styles.chip, { borderColor: colors.border, backgroundColor: form.squadGroup === group ? colors.primary : colors.bgElevated }]} onPress={() => setField('squadGroup')(group)}><Text style={{ color: form.squadGroup === group ? colors.onPrimary : colors.text }}>{group}</Text></TouchableOpacity>)}</View></View> : null}
        <View style={styles.field}><Text style={labelStyle}>{t('Pozicioni')}</Text><TextInput value={form.position} onChangeText={setField('position')} style={inputStyle} maxLength={80} /></View>
        <View style={styles.field}><Text style={labelStyle}>{t('Numri i fanellës')}</Text><TextInput value={form.jerseyNumber} onChangeText={(value) => setField('jerseyNumber')(value.replace(/\D/g, '').slice(0, 2))} style={inputStyle} keyboardType="number-pad" maxLength={2} /></View>
        {minor ? <View style={[styles.field, { width: '100%' }]}><Text style={labelStyle}>{t('Kontakti i kujdestarit')}</Text><TextInput value={form.parentEmail} onChangeText={setField('parentEmail')} style={inputStyle} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Text style={[styles.help, { color: colors.muted }]}>Emaili i autorizimit shkon te kujdestari; regjistrimi i klubit nuk jep pëlqim prindëror.</Text></View> : null}
      </View>
      {error ? <Text style={[styles.notice, { color: colors.danger }]}>{error}</Text> : null}
      {success ? <Text style={[styles.notice, { color: colors.success }]}>{success}</Text> : null}
      <TouchableOpacity style={buttonStyle} onPress={submit} disabled={saving || (mode !== 'club' && !clubId)}><Text style={styles.buttonText}>{saving ? t('Duke ruajtur…') : t('Regjistro atlet')}</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '800' },
  help: { fontSize: 12, marginTop: 5, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 10 },
  select: { justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  field: { width: '48%', marginBottom: 3 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, marginRight: 5, marginBottom: 7 },
  button: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 5 },
  buttonText: { color: '#fff', fontWeight: '800' },
  notice: { fontSize: 13, marginVertical: 8 },
  modalShade: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { maxHeight: '75%', borderRadius: 14, padding: 16 },
  clubOption: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
