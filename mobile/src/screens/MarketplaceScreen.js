import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createOrderRequest, extractErrorMessage, joncoinBalanceRequest, productsRequest } from '../api/client';

const PAGE_SIZE = 8;

function ProductCard({ item, onBuy }) {
  return (
    <View style={styles.card}>
      {item?.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <Text style={styles.name}>{item?.name || 'Product'}</Text>
      <Text style={styles.description}>{item?.description || 'No description'}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.price}>{item?.price || 0} JonCoin</Text>
        <Text style={styles.stock}>Stock: {item?.stock ?? 0}</Text>
      </View>
      <TouchableOpacity style={styles.buyBtn} onPress={() => onBuy(item)}>
        <Text style={styles.buyBtnText}>Buy</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MarketplaceScreen() {
  const [products, setProducts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [productsRes, balanceRes] = await Promise.all([productsRequest(), joncoinBalanceRequest()]);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setBalance(Number(balanceRes?.data?.balance || 0));
      setVisibleCount(PAGE_SIZE);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load marketplace'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onBuy = async (product) => {
    try {
      const quantity = 1;
      await createOrderRequest([{ productId: product.id, quantity }]);
      Alert.alert('Blerja', 'Porosia u krye me JonCoin.');
      await loadData({ silent: true });
    } catch (err) {
      Alert.alert('Purchase failed', extractErrorMessage(err, 'Could not create order'));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products.slice(0, visibleCount)}
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceLabel}>JonCoin Balance</Text>
          <Text style={styles.balanceValue}>{balance}</Text>
        </View>
      }
      renderItem={({ item }) => <ProductCard item={item} onBuy={onBuy} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (visibleCount < products.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, products.length));
        }
      }}
      ListFooterComponent={visibleCount < products.length ? <Text style={styles.footer}>Loading more...</Text> : null}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 14, paddingBottom: 28, backgroundColor: '#f8fafc', minHeight: '100%' },
  balanceWrap: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  balanceLabel: { color: '#9a3412', fontWeight: '700' },
  balanceValue: { marginTop: 4, fontSize: 22, color: '#c2410c', fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  image: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#e2e8f0', marginBottom: 8 },
  name: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  description: { color: '#475569', marginTop: 4, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  price: { color: '#15803d', fontWeight: '800' },
  stock: { color: '#64748b' },
  buyBtn: { backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
  buyBtnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
  footer: { textAlign: 'center', color: '#64748b', marginVertical: 10 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 30 },
});
