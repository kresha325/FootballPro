import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../theme/nativeComponents';
import OptimizedImage from '../components/media/OptimizedImage';
import { extractErrorMessage, productByIdRequest } from '../api/client';
import { useCart } from '../context/CartContext';
import { absoluteBackendUrl } from '../config/constants';
import { useLocale } from '../context/LocaleContext';

export default function ProductDetailScreen({ route, navigation }) {
  const { t } = useLocale();
  const productId = route?.params?.productId;
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await productByIdRequest(productId);
      setProduct(res.data);
    } catch (err) {
      setError(extractErrorMessage(err, t('Product not found')));
    } finally {
      setLoading(false);
    }
  }, [productId, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#9A6B12" /></View>;
  if (error || !product) {
    return (
      <View style={styles.center}>
        <Text>{error || t('Product unavailable')}</Text>
        <TouchableOpacity onPress={load}><Text style={styles.link}>{t('Try again')}</Text></TouchableOpacity>
      </View>
    );
  }

  const imageUri = absoluteBackendUrl(product.imageUrl);
  return (
    <View style={styles.wrap}>
      {imageUri ? <OptimizedImage uri={imageUri} style={styles.image} width={800} contentFit="cover" /> : null}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.meta}>{t(product.category)} · {t(product.condition || 'new')} · {t(product.status)}</Text>
      <Text>{product.description || t('No description.')}</Text>
      <Text style={styles.price}>{product.joncoinPrice || product.price} XCoin</Text>
      <Text>{t('Stock')}: {product.stock}</Text>
      {product.purchasable ? (
        <View style={styles.row}>
          <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              await addItem(product, qty);
              navigation.navigate('Cart');
            }}
          >
            <Text style={styles.buttonText}>{t('Add to cart')}</Text>
          </TouchableOpacity>
        </View>
      ) : <Text>{t('This product is not for sale.')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  image: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  name: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  meta: { color: '#64748b', marginBottom: 8 },
  price: { fontSize: 20, fontWeight: '700', marginVertical: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, width: 72, backgroundColor: '#fff' },
  button: { backgroundColor: '#9A6B12', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#9A6B12', marginTop: 12 },
});
