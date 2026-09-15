import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createReportRequest, extractErrorMessage } from '../api/client';

const REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Ngacmim' },
  { key: 'hate', label: 'Urrejtje' },
  { key: 'violence', label: 'Dhunë' },
  { key: 'sexual', label: 'Përmbajtje seksuale' },
  { key: 'impersonation', label: 'Identitet i rremë' },
  { key: 'scam', label: 'Mashtrim' },
  { key: 'other', label: 'Tjetër' },
];

/**
 * App Store UGC report sheet.
 * targetType: post | comment | profile | message | live | user
 */
export default function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  title = 'Raporto',
}) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const subtitle = useMemo(() => {
    const t = String(targetType || '');
    if (t === 'post') return 'Raporto këtë postim';
    if (t === 'comment') return 'Raporto këtë koment';
    if (t === 'message') return 'Raporto këtë mesazh';
    if (t === 'live') return 'Raporto këtë live';
    return 'Raporto këtë profil';
  }, [targetType]);

  const submit = async () => {
    if (!targetType || targetId == null) return;
    setBusy(true);
    try {
      await createReportRequest({
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      Alert.alert('Faleminderit', 'Raportimi u dërgua. Ekipi do ta shqyrtojë.');
      onClose?.();
      setDetails('');
      setReason('spam');
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u dërgua raportimi'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>

          <Text style={styles.label}>Arsyeja</Text>
          <View style={styles.reasons}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.chip, reason === r.key && styles.chipOn]}
                onPress={() => setReason(r.key)}
              >
                <Text style={[styles.chipText, reason === r.key && styles.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Detaje (opsionale)</Text>
          <TextInput
            style={styles.input}
            value={details}
            onChangeText={setDetails}
            placeholder="Përshkruaj shkurt..."
            placeholderTextColor="#94a3b8"
            multiline
          />

          <TouchableOpacity style={styles.submit} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Dërgo raportin</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={busy}>
            <Text style={styles.cancelText}>Anulo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sub: { marginTop: 4, marginBottom: 14, color: '#64748b', fontSize: 14 },
  label: { fontWeight: '700', color: '#0f172a', marginBottom: 8, marginTop: 4 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: '#0f172a',
    marginBottom: 14,
  },
  submit: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancel: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#64748b', fontWeight: '700' },
});

