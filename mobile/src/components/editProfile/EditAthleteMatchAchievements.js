import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { parseProfileJsonArray } from '../../utils/profileArrays';

const MATCH_RESULT_OPTIONS = [
  { label: 'Win', value: 'Win' },
  { label: 'Draw', value: 'Draw' },
  { label: 'Loss', value: 'Loss' },
];

const emptyMatch = () => ({
  date: '',
  opponent: '',
  result: 'Win',
  score: '',
  goals: '0',
  assists: '0',
  minutes: '',
  rating: '',
});

const emptyAchievement = () => ({
  icon: '🏆',
  title: '',
  type: '',
  description: '',
  progress: '100',
});

function FormModal({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function loadAthleteExtrasFromProfile(profile) {
  return {
    matches: parseProfileJsonArray(profile?.matches),
    achievements: parseProfileJsonArray(profile?.achievements),
  };
}

export default function EditAthleteMatchAchievements({ matches, achievements, onChangeMatches, onChangeAchievements }) {
  const [matchModal, setMatchModal] = useState({ open: false, index: null, draft: emptyMatch() });
  const [achModal, setAchModal] = useState({ open: false, index: null, draft: emptyAchievement() });

  const openMatchEdit = (index) => {
    const item = index != null ? matches[index] : null;
    setMatchModal({
      open: true,
      index,
      draft: {
        date: item?.date != null ? String(item.date) : '',
        opponent: item?.opponent != null ? String(item.opponent) : '',
        result: item?.result != null ? String(item.result) : 'Win',
        score: item?.score != null ? String(item.score) : '',
        goals: item?.goals != null ? String(item.goals) : '0',
        assists: item?.assists != null ? String(item.assists) : '0',
        minutes: item?.minutes != null ? String(item.minutes) : '',
        rating: item?.rating != null ? String(item.rating) : '',
      },
    });
  };

  const saveMatch = () => {
    const d = matchModal.draft;
    if (!d.opponent.trim()) {
      Alert.alert('Validation', 'Opponent is required.');
      return;
    }
    const entry = {
      date: d.date.trim(),
      opponent: d.opponent.trim(),
      result: d.result || 'Win',
      score: d.score.trim(),
      goals: Number(d.goals) || 0,
      assists: Number(d.assists) || 0,
      minutes: d.minutes.trim(),
      rating: d.rating.trim() !== '' ? Number(d.rating) : undefined,
    };
    const next = [...matches];
    if (matchModal.index != null) next[matchModal.index] = entry;
    else next.unshift(entry);
    onChangeMatches(next);
    setMatchModal({ open: false, index: null, draft: emptyMatch() });
  };

  const deleteMatch = (index) => {
    Alert.alert('Remove match', 'Delete this match from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onChangeMatches(matches.filter((_, i) => i !== index)),
      },
    ]);
  };

  const openAchEdit = (index) => {
    const item = index != null ? achievements[index] : null;
    setAchModal({
      open: true,
      index,
      draft: {
        icon: item?.icon != null ? String(item.icon) : '🏆',
        title: item?.title != null ? String(item.title) : '',
        type: item?.type != null ? String(item.type) : '',
        description: item?.description != null ? String(item.description) : '',
        progress: item?.progress != null ? String(item.progress) : '100',
      },
    });
  };

  const saveAchievement = () => {
    const d = achModal.draft;
    if (!d.title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    const progress = Math.min(100, Math.max(0, Number(d.progress) || 0));
    const entry = {
      icon: d.icon.trim() || '🏆',
      title: d.title.trim(),
      type: d.type.trim(),
      description: d.description.trim(),
      progress,
    };
    const next = [...achievements];
    if (achModal.index != null) next[achModal.index] = entry;
    else next.unshift(entry);
    onChangeAchievements(next);
    setAchModal({ open: false, index: null, draft: emptyAchievement() });
  };

  const deleteAchievement = (index) => {
    Alert.alert('Remove achievement', 'Delete this trophy/award?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onChangeAchievements(achievements.filter((_, i) => i !== index)),
      },
    ]);
  };

  const setMatchField = (key, value) =>
    setMatchModal((m) => ({ ...m, draft: { ...m.draft, [key]: value } }));

  const setAchField = (key, value) =>
    setAchModal((m) => ({ ...m, draft: { ...m.draft, [key]: value } }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Match history</Text>
      <Text style={styles.hint}>Shown on your public profile under Matches.</Text>
      {matches.map((m, idx) => (
        <View key={`m-${idx}`} style={styles.row}>
          <TouchableOpacity style={styles.rowMain} onPress={() => openMatchEdit(idx)}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {m.date ? `${m.date} · ` : ''}vs {m.opponent || '—'}
            </Text>
            <Text style={styles.rowMeta}>
              {[m.result, m.score].filter(Boolean).join(' ')} · G{m.goals ?? 0} A{m.assists ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteMatch(idx)} hitSlop={8}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => openMatchEdit(null)}>
        <Text style={styles.addBtnText}>+ Add match</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Trophies & awards</Text>
      <Text style={styles.hint}>Shown under Achievements on your profile.</Text>
      {achievements.map((a, idx) => (
        <View key={`a-${idx}`} style={styles.row}>
          <TouchableOpacity style={styles.rowMain} onPress={() => openAchEdit(idx)}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {a.icon || '🏆'} {a.title || 'Achievement'}
            </Text>
            {a.type ? <Text style={styles.rowMeta}>{a.type}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteAchievement(idx)} hitSlop={8}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => openAchEdit(null)}>
        <Text style={styles.addBtnText}>+ Add trophy / award</Text>
      </TouchableOpacity>

      <FormModal
        visible={matchModal.open}
        title={matchModal.index != null ? 'Edit match' : 'Add match'}
        onClose={() => setMatchModal({ open: false, index: null, draft: emptyMatch() })}
      >
        <Field label="Date" value={matchModal.draft.date} onChange={(v) => setMatchField('date', v)} placeholder="2024-03-15" />
        <Field label="Opponent *" value={matchModal.draft.opponent} onChange={(v) => setMatchField('opponent', v)} />
        <Text style={styles.fieldLabel}>Result</Text>
        <View style={styles.chipRow}>
          {MATCH_RESULT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, matchModal.draft.result === o.value && styles.chipActive]}
              onPress={() => setMatchField('result', o.value)}
            >
              <Text style={[styles.chipText, matchModal.draft.result === o.value && styles.chipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Score" value={matchModal.draft.score} onChange={(v) => setMatchField('score', v)} placeholder="2-1" />
        <Field label="Goals" value={matchModal.draft.goals} onChange={(v) => setMatchField('goals', v)} keyboardType="number-pad" />
        <Field label="Assists" value={matchModal.draft.assists} onChange={(v) => setMatchField('assists', v)} keyboardType="number-pad" />
        <Field label="Minutes" value={matchModal.draft.minutes} onChange={(v) => setMatchField('minutes', v)} keyboardType="number-pad" />
        <Field label="Rating (0–10)" value={matchModal.draft.rating} onChange={(v) => setMatchField('rating', v)} keyboardType="decimal-pad" />
        <TouchableOpacity style={styles.saveBtn} onPress={saveMatch}>
          <Text style={styles.saveBtnText}>Save match</Text>
        </TouchableOpacity>
      </FormModal>

      <FormModal
        visible={achModal.open}
        title={achModal.index != null ? 'Edit achievement' : 'Add achievement'}
        onClose={() => setAchModal({ open: false, index: null, draft: emptyAchievement() })}
      >
        <Field label="Icon (emoji)" value={achModal.draft.icon} onChange={(v) => setAchField('icon', v)} placeholder="🏆" />
        <Field label="Title *" value={achModal.draft.title} onChange={(v) => setAchField('title', v)} />
        <Field label="Type" value={achModal.draft.type} onChange={(v) => setAchField('type', v)} placeholder="League, Cup, …" />
        <Field
          label="Description"
          value={achModal.draft.description}
          onChange={(v) => setAchField('description', v)}
          multiline
        />
        <Field label="Progress %" value={achModal.draft.progress} onChange={(v) => setAchField('progress', v)} keyboardType="number-pad" />
        <TouchableOpacity style={styles.saveBtn} onPress={saveAchievement}>
          <Text style={styles.saveBtnText}>Save achievement</Text>
        </TouchableOpacity>
      </FormModal>
    </View>
  );
}

function Field({ label, value, onChange, multiline, ...rest }) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        {...rest}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  rowMain: { flex: 1, marginRight: 8 },
  rowTitle: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  rowMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  addBtn: {
    borderWidth: 2,
    borderColor: '#0f766e',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#0f766e', fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#0f172a' },
  modalCloseBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#64748b', fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
