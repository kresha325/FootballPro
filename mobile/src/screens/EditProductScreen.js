import React, { useCallback, useEffect, useState } from 'react';
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
import { extractErrorMessage, productByIdRequest, updateProductRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { absoluteBackendUrl } from '../config/constants';

const CATEGORIES = [
  { value: 'gear', label: 'Gear' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'merchandise', label: 'Merch' },
];

export default function EditProductScreen({ route, navigation }) {
  const { user } = useAuth();
  const productId = route.params?.productId;
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [category, setCategory] = useState('gear');
  const [image, setImage] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await productByIdRequest(productId);
      const p = res?.data;
      if (!p) throw new Error('Produkti nuk u gjet');
      if (user?.id && Number(p.sellerId) !== Number(user.id)) {
        Alert.alert('Leje', 'Nuk mund ta përpunosh këtë produkt.');
        navigation.goBack();
        return;
      }
      setName(String(p.name || ''));
      setDescription(String(p.description || ''));
      setPrice(String(p.price ?? ''));
      setStock(String(p.stock ?? '0'));
      setCategory(p.category || 'gear');
      setExistingImageUrl(p.imageUrl ? absoluteBackendUrl(p.imageUrl) : null);
      setImage(null);
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u ngarkua produkti.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, productId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Leje', 'Të lutem lejo aksesin në galeri.');
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
    const nameTrim = name.trim();
    if (!nameTrim) {
      Alert.alert('Mungon emri', 'Vendos emrin e produktit.');
      return;
    }
    const priceNum = parseFloat(String(price).replace(',', '.'));
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Çmim', 'Jep një çmim të vlefshëm.');
      return;
    }
    const stockNum = parseInt(String(stock), 10);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Gjendje', 'Jep sasinë (numër ≥ 0).');
      return;
    }

    setSaving(true);
    try {
      await updateProductRequest(productId, {
        name: nameTrim,
        description: description.trim(),
        price: priceNum,
        category,
        stock: stockNum,
        image: image || undefined,
      });
      Alert.alert('Sukses', 'Produkti u përditësua.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Dështoi', extractErrorMessage(err, 'Nuk u ruajtën ndryshimet.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !productId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Emri *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Emri i produktit" />
      <Text style={styles.label}>Përshkrimi</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Përshkrim"
        multiline
      />
      <Text style={styles.label}>Çmim (JonCoin) *</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Gjendje (stok) *</Text>
      <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" />
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
      <Text style={styles.label}>Foto e re (opsionale)</Text>
      <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
        <Text style={styles.imageBtnText}>{image ? 'Ndrysho foton e zgjedhur' : 'Zgjidh foto të re'}</Text>
      </TouchableOpacity>
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
      ) : existingImageUrl ? (
        <Image source={{ uri: existingImageUrl }} style={styles.preview} resizeMode="cover" />
      ) : null}
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Ruaj ndryshimet</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
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
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
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
