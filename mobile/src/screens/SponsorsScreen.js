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
import { createSponsorRequest, extractErrorMessage, sponsorsRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

function SponsorRow({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{item?.name || 'Sponsor'}</Text>
      <Text style={styles.rowSub}>{item?.link || 'No link'}</Text>
      <Text style={styles.rowMeta}>
        {item?.startDate ? String(item.startDate).slice(0, 10) : '-'} -> {item?.endDate ? String(item.endDate).slice(0, 10) : '-'}
      </Text>
    </View>
  );
}

export default function SponsorsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSponsors = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await sponsorsRequest();
      setItems(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load sponsors'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Media permission is required to attach sponsor image.');
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
      name: asset.fileName || `sponsor-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const onCreate = async () => {
    if (saving) return;
    if (!user?.id) {
      setError('User not loaded yet.');
      return;
    }
    if (!name.trim()) {
      setError('Sponsor name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createSponsorRequest({
        userId: user.id,
        name: name.trim(),
        link: link.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        image,
      });

      setName('');
      setLink('');
      setStartDate('');
      setEndDate('');
      setImage(null);
      await loadSponsors({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create sponsor'));
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
          <Text style={styles.sectionTitle}>Create Sponsor</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
          <TextInput style={styles.input} value={link} onChangeText={setLink} placeholder="Website link" autoCapitalize="none" />
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" autoCapitalize="none" />
          <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" autoCapitalize="none" />
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
            <Text style={styles.secondaryText}>{image ? 'Image selected' : 'Pick image (optional)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={onCreate} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Create Sponsor'}</Text>
          </TouchableOpacity>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadSponsors({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      renderItem={({ item }) => <SponsorRow item={item} />}
      ListEmptyComponent={<Text style={styles.empty}>No sponsors yet.</Text>}
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
