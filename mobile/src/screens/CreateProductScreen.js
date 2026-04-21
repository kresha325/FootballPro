import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createProductRequest, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'gear', label: 'Gear' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'merchandise', label: 'Merch' },
];

export default function CreateProductScreen({ navigation }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('gear');
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Leje', 'Të lutem lejo aksesin në galeri për foton e produktit.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `product-${Date.now()}.jpg`,
      });
    }
  };

  const onSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Sesioni', 'Duhet të jesh i futur.');
      return;
    }
    const nameTrim = name.trim();
    if (!nameTrim) {
      Alert.alert('Mungon emri', 'Vendos emrin e produktit.');
      return;
    }
    const priceNum = parseFloat(String(price).replace(',', '.'));
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Çmim', 'Jep një çmim të vlefshëm në JonCoin.');
      return;
    }
    const stockNum = parseInt(String(stock), 10);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Gjendje', 'Jep sasinë (numër ≥ 0).');
      return;
    }

    setSaving(true);
    try {
      await createProductRequest({
        name: nameTrim,
        description: description.trim(),
        price: priceNum,
        category,
        stock: stockNum,
        sellerId: user.id,
        image: image || undefined,
      });
      Alert.alert('Sukses', 'Produkti u shtua.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Dështoi', extractErrorMessage(err, 'Nuk u krijua produkti.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Emri *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="P.sh. Top futbolli" />
      <Text style={styles.label}>Përshkrimi</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Përshkrim i shkurtër"
        multiline
      />
      <Text style={styles.label}>Çmim (JonCoin) *</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="0"
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Gjendje *</Text>
      <TextInput
        style={styles.input}
        value={stock}
        onChangeText={setStock}
        placeholder="10"
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Kategoria *</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.chip, category === c.value && styles.chipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Foto (opsionale)</Text>
      <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
        <Text style={styles.imageBtnText}>{image ? 'Ndrysho foton' : 'Zgjidh nga galeria'}</Text>
      </TouchableOpacity>
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
      ) : null}
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Shto produktin</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  label: { color: '#0f172a', fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  imageBtn: { alignSelf: 'flex-start', marginTop: 4 },
  imageBtnText: { color: '#0f766e', fontWeight: '700' },
  preview: { width: '100%', height: 180, borderRadius: 10, marginTop: 8, backgroundColor: '#e2e8f0' },
  submitBtn: {
    marginTop: 24,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
