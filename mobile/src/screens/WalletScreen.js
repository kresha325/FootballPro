import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  extractErrorMessage,
  joncoinBalanceRequest,
  joncoinPurchaseRequest,
  joncoinTransactionsRequest,
  joncoinTransferRequest,
  joncoinWithdrawRequest,
} from '../api/client';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const loadData = useCallback(async ({ silent } = { silent: false }) => {
    if (!silent) setLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([joncoinBalanceRequest(), joncoinTransactionsRequest()]);
      setBalance(Number(balanceRes?.data?.balance || 0));
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
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

  const purchase = async () => {
    const amount = Number(buyAmount);
    if (!amount || amount <= 0) return;
    try {
      await joncoinPurchaseRequest(amount);
      setBuyAmount('');
      await loadData({ silent: true });
    } catch (err) {
      Alert.alert('Purchase failed', extractErrorMessage(err, 'Could not purchase JonCoin'));
    }
  };

  const withdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return;
    try {
      await joncoinWithdrawRequest(amount);
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
            <Text style={styles.cardTitle}>Buy JonCoin</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={buyAmount} onChangeText={setBuyAmount} placeholder="Amount" />
            <TouchableOpacity style={styles.primaryBtn} onPress={purchase}>
              <Text style={styles.primaryBtnText}>Buy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Withdraw JonCoin</Text>
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
});
