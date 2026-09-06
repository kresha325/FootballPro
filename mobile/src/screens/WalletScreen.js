import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  extractErrorMessage,
  joncoinBalanceRequest,
  joncoinTransactionsRequest,
  joncoinTransferRequest,
  joncoinWithdrawRequest,
  myOrdersRequest,
  sellerOrdersRequest,
  acceptOrderRequest,
  rejectOrderRequest,
  cancelOrderRequest,
} from '../api/client';
import { ALLOW_MOBILE_DIGITAL_PURCHASES, WEB_APP_URL } from '../config/constants';
import { JONCOIN_PACKS } from '../iap/products';
import { purchaseAndFulfill } from '../iap/purchase';

function WalletSkeleton() {
  return (
    <View style={styles.listContent}>
      {[1, 2, 3].map((i) => (
        <View key={`w-${i}`} style={[styles.card, styles.skeletonBlock]} />
      ))}
    </View>
  );
}

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [orderBusyId, setOrderBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingSku, setBuyingSku] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawFeePct, setWithdrawFeePct] = useState(5);
  const [toUserId, setToUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    try {
      const [balanceRes, txRes, ordersRes, salesRes] = await Promise.all([
        joncoinBalanceRequest(),
        joncoinTransactionsRequest(),
        myOrdersRequest(),
        sellerOrdersRequest(),
      ]);
      setBalance(Number(balanceRes?.data?.balance || 0));
      const pct = balanceRes?.data?.withdrawCommissionPercent;
      setWithdrawFeePct(Number.isFinite(Number(pct)) ? Number(pct) : 5);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      const ord = ordersRes?.data;
      setOrders(Array.isArray(ord) ? ord.slice(0, 15) : []);
      const sales = salesRes?.data;
      setSellerOrders(Array.isArray(sales) ? sales.slice(0, 15) : []);
    } catch (err) {
      Alert.alert('Wallet error', extractErrorMessage(err, 'Could not load wallet data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const purchasePack = async (pack) => {
    if (!ALLOW_MOBILE_DIGITAL_PURCHASES) {
      Alert.alert(
        'JonCoin',
        'Blerja e JonCoin me para reale në app kërkon IAP (App Store / Play). Për tani përdor web ose transfer nga një balancë ekzistuese.',
        [
          { text: 'Hap web', onPress: () => Linking.openURL(`${WEB_APP_URL}/wallet`).catch(() => {}) },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    setBuyingSku(pack.sku);
    try {
      const data = await purchaseAndFulfill(pack.sku, { type: 'inapp' });
      const bal = data?.fulfillment?.joncoinBalance;
      Alert.alert(
        'JonCoin',
        bal != null ? `U shtuan ${pack.amount} JC. Balanca: ${bal}` : `${pack.label} u blenë me sukses.`
      );
      await loadData({ silent: true });
    } catch (err) {
      if (err?.cancelled) return;
      Alert.alert('Purchase failed', extractErrorMessage(err, err?.message || 'Could not purchase JonCoin'));
    } finally {
      setBuyingSku(null);
    }
  };

  const withdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return;
    try {
      const res = await joncoinWithdrawRequest(amount);
      const d = res?.data || {};
      const msg =
        d.netPayout != null && d.feeAmount != null
          ? `Request sent. Gross ${d.grossAmount}, fee ${d.commissionPercent}% (${d.feeAmount}), net payout ${d.netPayout}.`
          : 'Withdrawal request sent.';
      Alert.alert('Withdraw', msg);
      setWithdrawAmount('');
      await loadData({ silent: true });
    } catch (err) {
      Alert.alert('Withdraw failed', extractErrorMessage(err, 'Could not request withdrawal'));
    }
  };

  const transfer = async () => {
    const userId = Number(toUserId);
    const amount = Number(transferAmount);
    if (!userId || !amount || amount <= 0) return;
    try {
      await joncoinTransferRequest(userId, amount);
      setToUserId('');
      setTransferAmount('');
      await loadData({ silent: true });
    } catch (err) {
      Alert.alert('Transfer failed', extractErrorMessage(err, 'Could not transfer JonCoin'));
    }
  };

  const acceptSale = (id) => {
    Alert.alert('Prano', 'JonCoin transferohen tani. Vazhdo?', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Prano',
        onPress: async () => {
          setOrderBusyId(id);
          try {
            await acceptOrderRequest(id);
            await loadData({ silent: true });
            Alert.alert('OK', 'Porosia u pranua. JonCoin u transferuan.');
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err, 'Pranimi dështoi'));
          } finally {
            setOrderBusyId(null);
          }
        },
      },
    ]);
  };

  const rejectSale = (id) => {
    Alert.alert('Refuzo', 'Porosia anulohet pa transfer JonCoin.', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Refuzo',
        style: 'destructive',
        onPress: async () => {
          setOrderBusyId(id);
          try {
            await rejectOrderRequest(id);
            await loadData({ silent: true });
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err, 'Refuzimi dështoi'));
          } finally {
            setOrderBusyId(null);
          }
        },
      },
    ]);
  };

  const cancelPurchase = (id) => {
    Alert.alert('Anulo', 'Anulo porosinë në pritje?', [
      { text: 'Jo', style: 'cancel' },
      {
        text: 'Po',
        style: 'destructive',
        onPress: async () => {
          setOrderBusyId(id);
          try {
            await cancelOrderRequest(id);
            await loadData({ silent: true });
          } catch (err) {
            Alert.alert('Gabim', extractErrorMessage(err, 'Anulimi dështoi'));
          } finally {
            setOrderBusyId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <WalletSkeleton />;
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={styles.listContent}
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
      ListHeaderComponent={
        <View>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>Wallet Balance</Text>
            <Text style={styles.balanceValue}>{balance} JonCoin</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Buy JonCoin (IAP)</Text>
            {ALLOW_MOBILE_DIGITAL_PURCHASES ? (
              JONCOIN_PACKS.map((pack) => (
                <TouchableOpacity
                  key={pack.sku}
                  style={[styles.primaryBtn, styles.packBtn, buyingSku && styles.btnDisabled]}
                  onPress={() => purchasePack(pack)}
                  disabled={!!buyingSku}
                >
                  <Text style={styles.primaryBtnText}>
                    {buyingSku === pack.sku ? 'Duke blerë…' : pack.label}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  Alert.alert('JonCoin', 'IAP nuk është aktiv. Hap web për blerje.', [
                    { text: 'Hap web', onPress: () => Linking.openURL(`${WEB_APP_URL}/wallet`).catch(() => {}) },
                    { text: 'OK', style: 'cancel' },
                  ])
                }
              >
                <Text style={styles.primaryBtnText}>Bli në web</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Withdraw JonCoin</Text>
            <Text style={styles.feeHint}>{withdrawFeePct}% withdrawal fee applies to the amount you cash out.</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder="Amount" />
            <TouchableOpacity style={styles.warningBtn} onPress={withdraw}>
              <Text style={styles.primaryBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transfer JonCoin</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={toUserId} onChangeText={setToUserId} placeholder="To User ID" />
            <TextInput style={styles.input} keyboardType="numeric" value={transferAmount} onChangeText={setTransferAmount} placeholder="Amount" />
            <TouchableOpacity style={styles.infoBtn} onPress={transfer}>
              <Text style={styles.primaryBtnText}>Transfer</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Shitjet e mia (prano)</Text>
          {sellerOrders.length === 0 ? (
            <Text style={styles.emptyInline}>Nuk ke shitje ende.</Text>
          ) : (
            sellerOrders.map((o) => (
              <View key={`sale-${o.id}`} style={styles.orderRow}>
                <Text style={styles.orderText}>
                  #{o.id} · {o.totalAmount} JC · {o.status || '—'}
                </Text>
                <Text style={styles.orderMeta}>
                  Nga: {o.buyerName || `#${o.userId}`} · {(o.products || []).map((p) => p.name).filter(Boolean).join(', ') || '—'}
                </Text>
                <Text style={styles.orderMeta}>
                  {o.deliveryMethod || '—'}
                  {o.buyerContact ? ` · ${o.buyerContact}` : ''}
                </Text>
                {o.deliveryAddress ? <Text style={styles.orderMeta}>Adresa: {o.deliveryAddress}</Text> : null}
                {o.status === 'pending' ? (
                  <View style={styles.orderActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      disabled={orderBusyId === o.id}
                      onPress={() => acceptSale(o.id)}
                    >
                      <Text style={styles.primaryBtnText}>Prano</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      disabled={orderBusyId === o.id}
                      onPress={() => rejectSale(o.id)}
                    >
                      <Text style={styles.primaryBtnText}>Refuzo</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Blerjet e mia</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyInline}>Nuk ka porosi ende.</Text>
          ) : (
            orders.map((o) => (
              <View key={String(o.id)} style={styles.orderRow}>
                <Text style={styles.orderText}>
                  #{o.id} · {o.totalAmount} JC · {o.status || '—'}
                </Text>
                <Text style={styles.orderMeta}>
                  Shitësi: {o.sellerName || `#${o.sellerId}`} · {(o.products || []).map((p) => p.name).filter(Boolean).join(', ') || '—'}
                </Text>
                {o.status === 'pending' ? (
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    disabled={orderBusyId === o.id}
                    onPress={() => cancelPurchase(o.id)}
                  >
                    <Text style={styles.primaryBtnText}>Anulo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Transactions</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.txCard}>
          <Text style={styles.txType}>{item?.type || 'transaction'} ({item?.status || 'pending'})</Text>
          <Text style={styles.txAmount}>{item?.amount} JonCoin</Text>
          <Text style={styles.txDesc}>{item?.description || 'No description'}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 14, paddingBottom: 30, backgroundColor: '#f8fafc', minHeight: '100%' },
  balanceCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  balanceTitle: { color: '#155e75', fontWeight: '700' },
  balanceValue: { color: '#0e7490', fontWeight: '800', fontSize: 22, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 8 },
  feeHint: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  primaryBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  packBtn: { marginBottom: 8 },
  btnDisabled: { opacity: 0.6 },
  warningBtn: { backgroundColor: '#ca8a04', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  infoBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { marginTop: 4, marginBottom: 8, color: '#334155', fontWeight: '700' },
  txCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  txType: { color: '#0f172a', fontWeight: '700' },
  txAmount: { color: '#0f766e', fontWeight: '800', marginTop: 4 },
  txDesc: { color: '#475569', marginTop: 4 },
  skeletonBlock: { height: 90, backgroundColor: '#e2e8f0' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  emptyInline: { color: '#64748b', marginBottom: 10, fontSize: 13 },
  orderRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  orderText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  orderMeta: { color: '#64748b', fontSize: 12, marginTop: 4 },
  orderActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 6,
  },
});
