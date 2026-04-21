import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { extractErrorMessage, joncoinBalanceRequest, productsRequest } from '../api/client';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { absoluteBackendUrl } from '../config/constants';

const PAGE_SIZE = 8;

function ProductCard({ item, onAddToCart, currentUserId, navigation }) {
  const [qty, setQty] = useState('1');
  const imageUri = absoluteBackendUrl(item?.imageUrl);
  const stock = Math.max(0, parseInt(String(item?.stock ?? 0), 10) || 0);
  const isOwn = currentUserId && item?.sellerId === currentUserId;
  const priceN = Math.round(parseFloat(String(item?.price || 0)) * 100) / 100;

  const onPressAdd = () => {
    const n = Math.max(1, parseInt(String(qty), 10) || 1);
    const take = isOwn ? 0 : Math.min(stock, n);
    onAddToCart(item, take);
  };

  return (
    <View style={styles.card}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : null}
      <Text style={styles.name}>{item?.name || 'Product'}</Text>
      <Text style={styles.description}>{item?.description || 'No description'}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.price}>
          {priceN} JonCoin {stock > 0 ? <Text style={styles.perUnit}>/ copë</Text> : null}
        </Text>
        <Text style={styles.stock}>Stok: {stock}</Text>
      </View>
      {!isOwn && stock > 0 ? (
        <View style={styles.qtyRow}>
          <Text style={styles.qtyLabel}>Sasia</Text>
          <TextInput
            style={styles.qtyInput}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1"
            editable={!isOwn}
          />
        </View>
      ) : null}
      {isOwn ? (
        <View>
          <Text style={styles.ownNote}>Kjo është listimi yt — nuk mund ta blihesh vetes.</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProduct', { productId: item.id })}
          >
            <Text style={styles.editBtnText}>Ndrysho produktin</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.buyBtn, (stock < 1 || isOwn) && styles.buyBtnDisabled]}
          onPress={onPressAdd}
          disabled={stock < 1}
        >
          <Text style={styles.buyBtnText}>{stock < 1 ? 'Nuk ka stok' : 'Shto në shportë'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function MarketplaceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addItem, totalPieces } = useCart();
  const focusSkipRef = useRef(true);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 6 }}>
          <NotificationHeaderButton />
          <TouchableOpacity
            onPress={() => navigation.navigate('Cart')}
            style={{ paddingRight: 8, paddingVertical: 4 }}
            accessibilityLabel="Shporta"
          >
            <View>
              <Ionicons name="cart-outline" size={26} color="#0f766e" />
              {totalPieces > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{totalPieces > 99 ? '99+' : totalPieces}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, totalPieces]);

  useFocusEffect(
    useCallback(() => {
      if (focusSkipRef.current) {
        focusSkipRef.current = false;
        return;
      }
      loadData({ silent: true });
    }, [loadData])
  );

  const onAddToCart = (product, quantity) => {
    if (user?.id != null && Number(product?.sellerId) === Number(user.id)) {
      return;
    }
    if (!quantity || quantity < 1) {
      Alert.alert('Sasi', 'Zgjidh të paktën 1 copë.');
      return;
    }
    const stock = Math.max(0, parseInt(String(product?.stock ?? 0), 10) || 0);
    if (stock < 1) {
      Alert.alert('Stok', 'Produkti nuk ka stok.');
      return;
    }
    if (quantity > stock) {
      Alert.alert('Stok', `Mund të shtosh maksimum ${stock} copë.`);
      return;
    }
    addItem(product, quantity);
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
    <View style={styles.wrap}>
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
        renderItem={({ item }) => (
          <ProductCard item={item} onAddToCart={onAddToCart} currentUserId={user?.id} navigation={navigation} />
        )}
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
      {user?.id ? (
        <TouchableOpacity
          style={[styles.fab, { bottom: 18 + insets.bottom }]}
          onPress={() => navigation.navigate('CreateProduct')}
          accessibilityLabel="Shto produkt"
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc' },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 14, paddingBottom: 88, backgroundColor: '#f8fafc', minHeight: '100%' },
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
  perUnit: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  qtyLabel: { color: '#334155', fontWeight: '600', marginRight: 10 },
  qtyInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  ownNote: { color: '#64748b', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  editBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f766e',
    alignItems: 'center',
  },
  editBtnText: { color: '#0f766e', fontWeight: '700' },
  buyBtn: { backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 9 },
  buyBtnDisabled: { backgroundColor: '#94a3b8' },
  buyBtnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
  footer: { textAlign: 'center', color: '#64748b', marginVertical: 10 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 30 },
  headerBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#dc2626',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
