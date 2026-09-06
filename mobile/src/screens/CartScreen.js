import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createOrderRequest, extractErrorMessage, joncoinBalanceRequest } from '../api/client';
import { useCart } from '../context/CartContext';
import { absoluteBackendUrl } from '../config/constants';

const METHODS = [
  { value: 'meetup', label: 'Takim' },
  { value: 'pickup', label: 'Marrje personale' },
  { value: 'shipping', label: 'Dërgesë' },
];

export default function CartScreen({ navigation }) {
  const { items, setLineQuantity, removeItem, clearCart, orderPayload, subtotalJonCoin, totalPieces } = useCart();
  const [paying, setPaying] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState('meetup');
  const [buyerContact, setBuyerContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const pay = useCallback(async () => {
    if (!orderPayload.length) {
      Alert.alert('Shporta', 'Shporta është bosh.');
      return;
    }
    if (!String(buyerContact || '').trim()) {
      Alert.alert('Kontakt', 'Vendos telefon ose email që shitësi të të kontaktojë.');
      return;
    }
    if (deliveryMethod === 'shipping' && !String(deliveryAddress || '').trim()) {
      Alert.alert('Adresa', 'Vendos adresën e dërgesës.');
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
      'Dërgo porosinë',
      `${subtotalJonCoin} JonCoin për ${totalPieces} copë. Coinat transferohen vetëm kur shitësi e pranon.`,
      [
        { text: 'Anulo', style: 'cancel' },
        {
          text: 'Dërgo',
          onPress: async () => {
            setPaying(true);
            try {
              await createOrderRequest({
                products: orderPayload,
                deliveryMethod,
                buyerContact: String(buyerContact).trim(),
                deliveryAddress: String(deliveryAddress).trim() || undefined,
                deliveryNotes: String(deliveryNotes).trim() || undefined,
              });
              clearCart();
              Alert.alert(
                'Pending',
                'Porosia u dërgua. Shitësi e pranon te Wallet → Shitjet. JonCoin ende nuk u transferuan.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (err) {
              Alert.alert('Porosia dështoi', extractErrorMessage(err, 'Could not create order'));
            } finally {
              setPaying(false);
            }
          },
        },
      ]
    );
  }, [
    orderPayload,
    subtotalJonCoin,
    totalPieces,
    clearCart,
    navigation,
    deliveryMethod,
    buyerContact,
    deliveryAddress,
    deliveryNotes,
  ]);

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
        ListFooterComponent={
          <View style={styles.checkoutBox}>
            <Text style={styles.checkoutTitle}>Si e merr / dërgon?</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.methodChip, deliveryMethod === m.value && styles.methodChipOn]}
                  onPress={() => setDeliveryMethod(m.value)}
                >
                  <Text style={[styles.methodChipText, deliveryMethod === m.value && styles.methodChipTextOn]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={buyerContact}
              onChangeText={setBuyerContact}
              placeholder="Kontakt (tel / email) *"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder={deliveryMethod === 'shipping' ? 'Adresa e dërgesës *' : 'Vendtakimi / adresa (opsionale)'}
              multiline
            />
            <TextInput
              style={styles.input}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="Shënim (opsionale)"
            />
          </View>
        }
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
        <Text style={styles.pendingHint}>Pending derisa shitësi të pranojë — pastaj kalojnë coinat.</Text>
        <TouchableOpacity style={[styles.payBtn, paying && styles.payBtnDisabled]} onPress={pay} disabled={paying}>
          {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Dërgo porosinë</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 14, paddingBottom: 160 },
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
  checkoutBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 4,
  },
  checkoutTitle: { fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  methodChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  methodChipOn: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  methodChipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  methodChipTextOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
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
  totalVal: { fontSize: 22, fontWeight: '800', color: '#0f766e', marginBottom: 4 },
  pendingHint: { color: '#b45309', fontSize: 11, marginBottom: 10 },
  payBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#0f172a' },
  emptySub: { marginTop: 6, color: '#64748b', textAlign: 'center' },
  backBtn: {
    marginTop: 18,
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
