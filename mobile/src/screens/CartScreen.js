import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createOrderRequest, extractErrorMessage, joncoinBalanceRequest } from '../api/client';
import { useCart } from '../context/CartContext';
import { absoluteBackendUrl } from '../config/constants';

export default function CartScreen({ navigation }) {
  const { items, setLineQuantity, removeItem, clearCart, orderPayload, subtotalJonCoin, totalPieces } = useCart();
  const [paying, setPaying] = useState(false);

  const pay = useCallback(async () => {
    if (!orderPayload.length) {
      Alert.alert('Shporta', 'Shporta është bosh.');
      return;
    }
    let balance = 0;
    try {
      const balanceRes = await joncoinBalanceRequest();
      balance = Number(balanceRes?.data?.balance || 0);
    } catch (_e) {
      Alert.alert('JonCoin', 'Nuk u lexua balanca.');
      return;
    }
    if (balance < subtotalJonCoin) {
      Alert.alert('JonCoin', 'Nuk ke mjaftueshëm JonCoin për këtë porosi.');
      return;
    }
    Alert.alert(
      'Konfirmo',
      `Paguaj ${subtotalJonCoin} JonCoin për ${totalPieces} copë?`,
      [
        { text: 'Anulo', style: 'cancel' },
        {
          text: 'Paguaj',
          onPress: async () => {
            setPaying(true);
            try {
              await createOrderRequest(orderPayload);
              clearCart();
              Alert.alert('Sukses', 'Porosia u krye. Shitësit morën njoftime në chat.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Porosia dështoi', extractErrorMessage(err, 'Could not create order'));
            } finally {
              setPaying(false);
            }
          },
        },
      ]
    );
  }, [orderPayload, subtotalJonCoin, totalPieces, clearCart, navigation]);

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="cart-outline" size={64} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Shporta është bosh</Text>
        <Text style={styles.emptySub}>Shto produkte nga marketplace.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kthehu te produktet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(x) => String(x.productId)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const uri = absoluteBackendUrl(item.imageUrl);
          const cap = Math.max(0, parseInt(String(item.maxStock ?? 0), 10) || 0);
          const q = parseInt(String(item.quantity), 10) || 1;
          return (
            <View style={styles.row}>
              {uri ? <Image source={{ uri }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPh]} />}
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {(Number(item.price) || 0).toFixed(2)} JonCoin × {q}
                </Text>
                <View style={styles.qtyBar}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setLineQuantity(item.productId, q - 1)}
                    disabled={q <= 1}
                  >
                    <Ionicons name="remove" size={20} color={q <= 1 ? '#cbd5e1' : '#0f172a'} />
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{q}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setLineQuantity(item.productId, q + 1)}
                    disabled={q >= cap}
                  >
                    <Ionicons name="add" size={20} color={q >= cap ? '#cbd5e1' : '#0f172a'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.trash} onPress={() => removeItem(item.productId)}>
                    <Ionicons name="trash-outline" size={22} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalVal}>{subtotalJonCoin} JonCoin</Text>
        <TouchableOpacity style={[styles.payBtn, paying && styles.payBtnDisabled]} onPress={pay} disabled={paying}>
          {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Paguaj me JonCoin</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 14, paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, marginLeft: 10 },
  rowName: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  rowMeta: { color: '#64748b', marginTop: 4, fontSize: 13 },
  qtyBar: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  qtyNum: { marginHorizontal: 12, fontWeight: '800', fontSize: 16, color: '#0f172a' },
  trash: { marginLeft: 'auto', padding: 6 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: { color: '#64748b', fontSize: 13 },
  totalVal: { fontSize: 22, fontWeight: '800', color: '#0f766e', marginBottom: 12 },
  payBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', color: '#334155' },
  emptySub: { marginTop: 8, color: '#64748b', textAlign: 'center' },
  backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0f766e', borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
