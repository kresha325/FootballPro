import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../../theme/nativeComponents';
import {
  createMediaRequest,
  extractErrorMessage,
} from '../../api/client';
import {
  MEDIA_CATEGORIES,
  MEDIA_VISIBILITIES,
  parseYouTubeUrl,
} from '../../utils/youtubeVideo';
import YouTubeWebPlayer from './YouTubeWebPlayer';

export default function AddMediaSheet({
  visible,
  onClose,
  onSaved,
  defaults = {},
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [category, setCategory] = useState(defaults.category || 'other');
  const [visibility, setVisibility] = useState('public');
  const [season, setSeason] = useState(defaults.season || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => parseYouTubeUrl(youtubeUrl), [youtubeUrl]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setYoutubeUrl('');
    setCategory(defaults.category || 'other');
    setVisibility('public');
    setSeason(defaults.season || '');
    setError('');
  };

  const onSubmit = async () => {
    setError('');
    if (!preview.ok) {
      setError(preview.error || 'URL e pavlefshme');
      return;
    }
    if (!title.trim()) {
      setError('Titulli është i detyrueshëm');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        youtubeUrl: youtubeUrl.trim(),
        category,
        visibility,
        season: season.trim() || undefined,
      };
      if (defaults.playerId) payload.playerId = defaults.playerId;
      if (defaults.clubId) payload.clubId = defaults.clubId;
      if (defaults.matchId) payload.matchId = defaults.matchId;
      if (defaults.tournamentId) payload.tournamentId = defaults.tournamentId;

      const res = await createMediaRequest(payload);
      onSaved?.(res.data);
      reset();
      onClose?.();
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u ruajt videoja'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Shto video YouTube</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>
              Ngarko ndeshjen në YouTube, pastaj ngjit linkun. X TALENTI nuk ruan video 90-minutëshe.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="YouTube URL"
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {youtubeUrl ? (
              preview.ok ? (
                <YouTubeWebPlayer videoId={preview.videoId} height={180} />
              ) : (
                <Text style={styles.error}>{preview.error}</Text>
              )
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Titulli"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.area]}
              placeholder="Përshkrimi"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Text style={styles.label}>Kategoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {MEDIA_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.chip, category === c.value && styles.chipOn]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text style={[styles.chipText, category === c.value && styles.chipTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Visibility</Text>
            <View style={styles.row}>
              {MEDIA_VISIBILITIES.map((v) => (
                <TouchableOpacity
                  key={v.value}
                  style={[styles.chip, visibility === v.value && styles.chipOn]}
                  onPress={() => setVisibility(v.value)}
                >
                  <Text style={[styles.chipText, visibility === v.value && styles.chipTextOn]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Sezoni (opsionale)"
              value={season}
              onChangeText={setSeason}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Ruaj videon</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  close: { fontSize: 20, color: '#64748b', padding: 4 },
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4 },
  chips: { flexGrow: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipTextOn: { color: '#fff' },
  error: { color: '#b91c1c', fontSize: 13 },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontWeight: '800', color: '#0f172a', fontSize: 15 },
});
