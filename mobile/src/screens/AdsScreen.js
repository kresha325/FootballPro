import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import * as ImagePicker from 'expo-image-picker';
import { adsRequest, createAdRequest, extractErrorMessage } from '../api/client';
import { alertMediaLibraryDenied, ensureMediaLibraryPermission } from '../utils/mediaPermissions';

const EUR_PER_UNIT = 1;
const SECONDS_PER_UNIT = 3;

/** €1 per 3s of media, charged per campaign day. Video 12s → €4/day. */
function pricePerDayFromSeconds(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return EUR_PER_UNIT;
  return Math.max(1, Math.ceil(n / SECONDS_PER_UNIT)) * EUR_PER_UNIT;
}

function AdRow({ item }) {
  const days =
    item?.startDate && item?.endDate
      ? Math.max(1, Math.round((new Date(item.endDate) - new Date(item.startDate)) / 86400000))
      : null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{item?.title || 'Ad'}</Text>
      <Text style={styles.rowSub}>{item?.text || ''}</Text>
      <Text style={styles.rowMeta}>
        {item?.mediaType === 'video' ? 'Video' : 'Foto'}
        {item?.displaySeconds ? ` · ${item.displaySeconds}s shfaqje` : ''}
        {item?.priceEur != null ? ` · €${Number(item.priceEur).toFixed(0)}` : ''}
        {days ? ` · ${days} ditë` : ''}
      </Text>
    </View>
  );
}

export default function AdsScreen() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState('#34d399');
  const [days, setDays] = useState('1');
  const [media, setMedia] = useState(null);
  const [mediaDurationSec, setMediaDurationSec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pricing = useMemo(() => {
    const d = Math.max(1, parseInt(String(days || '1'), 10) || 1);
    const perDay =
      media?.kind === 'video' && mediaDurationSec
        ? pricePerDayFromSeconds(mediaDurationSec)
        : EUR_PER_UNIT;
    const displaySeconds =
      media?.kind === 'video' && mediaDurationSec
        ? mediaDurationSec
        : SECONDS_PER_UNIT;
    return {
      days: d,
      pricePerDay: perDay,
      displaySeconds,
      priceEur: perDay * d,
    };
  }, [days, media?.kind, mediaDurationSec]);

  const loadAds = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await adsRequest();
      setItems(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load ads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const pickMedia = async () => {
    setError('');
    const access = await ensureMediaLibraryPermission();
    if (!access.ok) {
      alertMediaLibraryDenied();
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const isVideo =
        asset.type === 'video' || String(asset.mimeType || '').startsWith('video/');
      const durationSec = isVideo && asset.duration != null
        ? Math.max(1, Math.round(Number(asset.duration) > 1000 ? Number(asset.duration) / 1000 : Number(asset.duration)))
        : null;

      setMedia({
        uri: asset.uri,
        name: asset.fileName || `ad-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        kind: isVideo ? 'video' : 'image',
      });
      setMediaDurationSec(durationSec);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nuk u hap galeria'));
    }
  };

  const onDaysChange = (value) => {
    const cleaned = value.replace(/[^\d]/g, '');
    setDays(cleaned);
  };

  const onCreate = async () => {
    if (saving) return;
    if (!title.trim() || !text.trim()) {
      setError('Title and text are required.');
      return;
    }
    const dayCount = Math.max(1, parseInt(String(days || '1'), 10) || 1);

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        text: text.trim(),
        color: color.trim() || '#34d399',
        days: dayCount,
      };
      if (mediaDurationSec) payload.mediaDurationSec = mediaDurationSec;
      if (media?.kind === 'video') {
        payload.video = media;
      } else if (media) {
        payload.image = media;
      }

      await createAdRequest(payload);

      setTitle('');
      setText('');
      setColor('#34d399');
      setDays('1');
      setMedia(null);
      setMediaDurationSec(null);
      await loadAds({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create ad'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#9A6B12" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create Ad</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Text" />
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Color (hex, optional)"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={days}
            onChangeText={onDaysChange}
            placeholder="Ditë (duration)"
            keyboardType="number-pad"
          />
          <Text style={styles.pricingHint}>
            €{EUR_PER_UNIT}/ditë = {SECONDS_PER_UNIT}s media. Video 12s → €4/ditë. Total = çmimi ditor ×
            ditët e kampanjës.
          </Text>
          <Text style={styles.pricingCalc}>
            {media?.kind === 'video' && mediaDurationSec
              ? `Video ${mediaDurationSec}s → €${pricing.pricePerDay}/ditë × ${pricing.days} ditë = €${pricing.priceEur}`
              : `€${pricing.pricePerDay}/ditë × ${pricing.days} ditë = €${pricing.priceEur} · ${pricing.displaySeconds}s shfaqje`}
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickMedia}>
            <Text style={styles.secondaryText}>
              {media
                ? media.kind === 'video'
                  ? `Video zgjedhur${mediaDurationSec ? ` (${mediaDurationSec}s)` : ''}`
                  : 'Foto zgjedhur'
                : 'Pick photo / video (optional)'}
            </Text>
          </TouchableOpacity>
          {media ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setMedia(null);
                setMediaDurationSec(null);
              }}
            >
              <Text style={styles.clearText}>Hiq median</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={onCreate}
            disabled={saving}
          >
            <Text style={styles.primaryText}>
              {saving ? 'Saving...' : `Create Ad · €${pricing.priceEur}`}
            </Text>
          </TouchableOpacity>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadAds({ silent: true });
          }}
          colors={['#9A6B12']}
        />
      }
      renderItem={({ item }) => <AdRow item={item} />}
      ListEmptyComponent={<Text style={styles.empty}>No active ads.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, backgroundColor: '#f8fafc', minHeight: '100%' },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  pricingHint: { color: '#64748b', fontSize: 12, lineHeight: 17, marginBottom: 6 },
  pricingCalc: { color: '#9A6B12', fontWeight: '700', fontSize: 13, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#9A6B12',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#9A6B12',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: '#9A6B12', fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: 8 },
  clearText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.7 },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: { color: '#0f172a', fontWeight: '800' },
  rowSub: { color: '#334155', marginTop: 4 },
  rowMeta: { color: '#64748b', marginTop: 6, fontSize: 12 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 18 },
  error: { color: '#b91c1c', marginBottom: 6 },
});
