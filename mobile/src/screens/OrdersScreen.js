import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from '../theme/nativeComponents';
import {
  extractErrorMessage,
  myOrdersRequest,
  refundOrderRequest,
  sellerOrdersRequest,
  sellerSummaryRequest,
  updateOrderStatusRequest,
} from '../api/client';

const NEXT = { paid: 'processing', processing: 'shipped', shipped: 'delivered' };

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, selling, sum] = await Promise.all([myOrdersRequest(), sellerOrdersRequest(), sellerSummaryRequest()]);
      setOrders(Array.isArray(mine.data) ? mine.data : []);
      setSales(Array.isArray(selling.data) ? selling.data : []);
      setSummary(sum.data || null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Porositë nuk u ngarkuan'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (err) {
      Alert.alert('Porosia', extractErrorMessage(err, 'Veprimi dështoi'));
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#9A6B12" /></View>;
  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
        <TouchableOpacity onPress={load}><Text style={styles.link}>Provo përsëri</Text></TouchableOpacity>
      </View>
    );
  }

  const card = (order, seller) => (
    <View key={`${seller ? 's' : 'b'}-${order.id}`} style={styles.card}>
      <Text style={styles.title}>#{order.id} · {order.status}</Text>
      <Text>{order.totalAmount} XCoin</Text>
      <Text>{Array.isArray(order.products) ? order.products.map((line) => `${line.name} × ${line.quantity}`).join(', ') : ''}</Text>
      {seller && NEXT[order.status] ? (
        <TouchableOpacity style={styles.button} onPress={() => run(() => updateOrderStatusRequest(order.id, NEXT[order.status]))}>
          <Text style={styles.buttonText}>{NEXT[order.status]}</Text>
        </TouchableOpacity>
      ) : null}
      {seller && ['paid', 'processing', 'shipped', 'delivered'].includes(order.status) ? (
        <TouchableOpacity onPress={() => run(() => refundOrderRequest(order.id))}><Text style={styles.link}>Rimburso</Text></TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {summary ? (
        <View style={styles.card}>
          <Text>Bruto {summary.grossSales} · tarifa {summary.platformFees} · neto {summary.netAmount}</Text>
          <Text>Të përfunduara {summary.completedOrders} · të rimbursuara {summary.refundedOrders}</Text>
          <Text>Balanca {summary.sellerBalance} XCoin</Text>
        </View>
      ) : null}
      <Text style={styles.section}>Blerjet</Text>
      {orders.length ? orders.map((order) => card(order, false)) : <Text>Nuk ke blerje.</Text>}
      <Text style={styles.section}>Shitjet</Text>
      {sales.length ? sales.map((order) => card(order, true)) : <Text>Nuk ke shitje.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  section: { fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  title: { fontWeight: '700', textTransform: 'capitalize' },
  button: { marginTop: 8, backgroundColor: '#9A6B12', borderRadius: 8, padding: 8, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#9A6B12', marginTop: 8 },
});
