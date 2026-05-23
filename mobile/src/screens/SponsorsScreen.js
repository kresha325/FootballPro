import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  createSponsorRequest,
  deleteSponsorRequest,
  extractErrorMessage,
  sponsorsRequest,
  updateSponsorRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

function SponsorRow({ item, onEdit, onDelete, deleting }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item?.name || 'Sponsor'}</Text>
        <Text style={styles.rowSub}>{item?.link || 'No link'}</Text>
        <Text style={styles.rowMeta}>
          {item?.startDate ? String(item.startDate).slice(0, 10) : '-'} → {item?.endDate ? String(item.endDate).slice(0, 10) : '-'}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={() => onEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="create-outline" size={20} color="#0f766e" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(item)} disabled={deleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={20} color="#dc2626" />
        </TouchableOpacity>
      </View>
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
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLink('');
    setStartDate('');
    setEndDate('');
    setImage(null);
  };

  const onEdit = (item) => {
    setEditingId(item.id);
    setName(item.name || '');
    setLink(item.link || '');
    setStartDate(item.startDate ? String(item.startDate).slice(0, 10) : '');
    setEndDate(item.endDate ? String(item.endDate).slice(0, 10) : '');
    setImage(null);
  };

  const onDelete = (item) => {
    Alert.alert('Delete sponsor', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteSponsorRequest(item.id);
            if (editingId === item.id) resetForm();
            await loadSponsors({ silent: true });
          } catch (err) {
            setError(extractErrorMessage(err, 'Failed to delete sponsor'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const onSave = async () => {
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
      const payload = {
        name: name.trim(),
        link: link.trim(),
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      };
      if (editingId) {
        await updateSponsorRequest(editingId, payload);
      } else {
        await createSponsorRequest({
          userId: user.id,
          ...payload,
          image,
        });
      }
      resetForm();
      await loadSponsors({ silent: true });
    } catch (err) {
      setError(extractErrorMessage(err, editingId ? 'Failed to update sponsor' : 'Failed to create sponsor'));
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
          <Text style={styles.sectionTitle}>{editingId ? 'Edit Sponsor' : 'Create Sponsor'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
          <TextInput style={styles.input} value={link} onChangeText={setLink} placeholder="Website link" autoCapitalize="none" />
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" autoCapitalize="none" />
          <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" autoCapitalize="none" />
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
            <Text style={styles.secondaryText}>{image ? 'Image selected' : 'Pick image (optional)'}</Text>
          </TouchableOpacity>
          {editingId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetForm}>
              <Text style={styles.secondaryText}>Cancel edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={onSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create Sponsor'}</Text>
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
      renderItem={({ item }) => (
        <SponsorRow item={item} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === item.id} />
      )}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowBody: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: 12, paddingLeft: 8 },
  rowTitle: { color: '#0f172a', fontWeight: '800' },
  rowSub: { color: '#334155', marginTop: 4 },
  rowMeta: { color: '#64748b', marginTop: 6, fontSize: 12 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 18 },
  error: { color: '#b91c1c', marginBottom: 6 },
});
