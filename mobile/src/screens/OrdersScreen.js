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
import { useLocale } from '../context/LocaleContext';

const NEXT = { paid: 'processing', processing: 'shipped', shipped: 'delivered' };

export default function OrdersScreen() {
  const { t } = useLocale();
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
      setError(extractErrorMessage(err, t('Orders could not be loaded')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (err) {
      Alert.alert(t('Order'), extractErrorMessage(err, t('Action failed')));
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
      <Text style={styles.title}>#{order.id} · {t(order.status)}</Text>
      <Text>{order.totalAmount} XCoin</Text>
      <Text>{Array.isArray(order.products) ? order.products.map((line) => `${line.name} × ${line.quantity}`).join(', ') : ''}</Text>
      {seller && NEXT[order.status] ? (
        <TouchableOpacity style={styles.button} onPress={() => run(() => updateOrderStatusRequest(order.id, NEXT[order.status]))}>
          <Text style={styles.buttonText}>{t(NEXT[order.status])}</Text>
        </TouchableOpacity>
      ) : null}
      {seller && ['paid', 'processing', 'shipped', 'delivered'].includes(order.status) ? (
        <TouchableOpacity onPress={() => run(() => refundOrderRequest(order.id))}><Text style={styles.link}>{t('Refund')}</Text></TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {summary ? (
        <View style={styles.card}>
          <Text>{t('Gross')} {summary.grossSales} · {t('Fees')} {summary.platformFees} · {t('Net')} {summary.netAmount}</Text>
          <Text>{t('Completed')} {summary.completedOrders} · {t('Refunded')} {summary.refundedOrders}</Text>
          <Text>{t('Balance')} {summary.sellerBalance} XCoin</Text>
        </View>
      ) : null}
      <Text style={styles.section}>{t('Purchases')}</Text>
      {orders.length ? orders.map((order) => card(order, false)) : <Text>{t('No purchases yet.')}</Text>}
      <Text style={styles.section}>{t('Sales')}</Text>
      {sales.length ? sales.map((order) => card(order, true)) : <Text>{t('No sales yet.')}</Text>}
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
