import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { adsRequest, createAdRequest, extractErrorMessage } from '../api/client';

function AdRow({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{item?.title || 'Ad'}</Text>
      <Text style={styles.rowSub}>{item?.text || ''}</Text>
      <Text style={styles.rowMeta}>Color: {item?.color || '#34d399'}</Text>
    </View>
  );
}

export default function AdsScreen() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState('#34d399');
  const [days, setDays] = useState('7');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Media permission is required to attach ad image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setImage({
      uri: asset.uri,
      name: asset.fileName || `ad-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const onCreate = async () => {
    if (saving) return;
    if (!title.trim() || !text.trim()) {
      setError('Title and text are required.');
      return;
    }
    if (!Number(days) || Number(days) <= 0) {
      setError('Days must be greater than 0.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createAdRequest({
        title: title.trim(),
        text: text.trim(),
        color: color.trim() || '#34d399',
        days: Number(days),
        image,
      });

      setTitle('');
      setText('');
      setColor('#34d399');
      setDays('7');
      setImage(null);
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
        <ActivityIndicator size="large" color="#0f766e" />
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
          <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Color (hex, optional)" autoCapitalize="none" />
          <TextInput style={styles.input} value={days} onChangeText={setDays} placeholder="Days" keyboardType="number-pad" />
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
            <Text style={styles.secondaryText}>{image ? 'Image selected' : 'Pick image (optional)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={onCreate} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Create Ad'}</Text>
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
          colors={['#0f766e']}
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
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: '#0f766e', fontWeight: '700' },
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
