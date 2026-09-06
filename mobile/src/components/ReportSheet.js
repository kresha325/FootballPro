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
