import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  extractErrorMessage,
  premiumCheckoutRequest,
  premiumVerifySessionRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

const PENDING_SESSION_KEY = 'premium_checkout_session_id';

const plans = [
  {
    key: 'monthly',
    title: 'Premium mujor',
    price: '€9.99 / muaj',
    perks: ['Analitika e avancuar', 'Rekomandime prioritare', 'Badge Premium', 'Më pak reklama'],
  },
  {
    key: 'yearly',
    title: 'Premium vjetor',
    price: '€99.99 / vit',
    badge: 'Kurseni ~17%',
    perks: ['Gjithçka nga mujori', '2 muaj falas', 'Turne ekskluzive', 'Akses i hershëm'],
  },
];

export default function PremiumScreen() {
  const { user, refreshMe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);

  React.useEffect(() => {
    AsyncStorage.getItem(PENDING_SESSION_KEY).then((id) => {
      if (id) setPendingSessionId(id);
    });
  }, []);

  const onSubscribe = useCallback(async () => {
    if (user?.premium) return;
    setLoading(true);
    try {
      const { data } = await premiumCheckoutRequest(selectedPlan);

      if (data.mode === 'demo' && data.success) {
        await refreshMe();
        Alert.alert('Premium aktiv', data.message || 'Llogaria jote është Premium.');
        return;
      }

      if (data.mode === 'stripe' && data.url) {
        if (data.sessionId) {
          await AsyncStorage.setItem(PENDING_SESSION_KEY, data.sessionId);
          setPendingSessionId(data.sessionId);
        }
        const canOpen = await Linking.canOpenURL(data.url);
        if (!canOpen) {
          Alert.alert('Gabim', 'Nuk u hap lidhja e pagesës.');
          return;
        }
        await Linking.openURL(data.url);
        Alert.alert(
          'Pagesa Stripe',
          'Përfundo pagesën në shfletues. Pastaj kthehu këtu dhe shtyp "Kam përfunduar pagesën".',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert('Gabim', 'Përgjigje e papritur nga serveri.');
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u nis dot pagesa'));
    } finally {
      setLoading(false);
    }
  }, [refreshMe, selectedPlan, user?.premium]);

  const onVerifyPayment = useCallback(async () => {
    const sessionId = pendingSessionId;
    if (!sessionId) {
      Alert.alert('Verifikim', 'Nuk ka sesion pagese në pritje. Nis upgrade përsëri.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await premiumVerifySessionRequest(sessionId);
      if (data.success) {
        await AsyncStorage.removeItem(PENDING_SESSION_KEY);
        setPendingSessionId(null);
        await refreshMe();
        Alert.alert('Sukses', 'Premium u aktivizua!');
      } else {
        Alert.alert(
          'Në pritje',
          'Pagesa nuk është konfirmuar ende. Provo përsëri pas disa sekondash.'
        );
      }
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Verifikimi dështoi'));
    } finally {
      setLoading(false);
    }
  }, [pendingSessionId, refreshMe]);

  const isPremium = !!user?.premium;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Go Premium</Text>
        <Text style={styles.heroSub}>Zhblloko mjetet premium për karrierën tënde.</Text>
      </View>

      <View style={[styles.statusCard, isPremium ? styles.active : styles.inactive]}>
        <Text style={styles.statusTitle}>{isPremium ? 'Premium aktiv' : 'Plani falas'}</Text>
        <Text style={styles.statusText}>
          {isPremium
            ? 'Ke akses në të gjitha përfitimet Premium.'
            : 'Zgjidh një plan dhe aktivizo Premium.'}
        </Text>
      </View>

      <View style={styles.planToggle}>
        {plans.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.toggleBtn, selectedPlan === p.key && styles.toggleBtnActive]}
            onPress={() => setSelectedPlan(p.key)}
          >
            <Text style={[styles.toggleText, selectedPlan === p.key && styles.toggleTextActive]}>
              {p.key === 'monthly' ? 'Mujor' : 'Vjetor'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {plans
        .filter((p) => p.key === selectedPlan)
        .map((plan) => (
          <View key={plan.key} style={styles.planCard}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planPrice}>{plan.price}</Text>
            {plan.badge ? (
              <View style={styles.planBadgeWrap}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            ) : null}
            {plan.perks.map((perk) => (
              <Text key={`${plan.key}-${perk}`} style={styles.perk}>
                ✓ {perk}
              </Text>
            ))}
          </View>
        ))}

      <TouchableOpacity
        style={[styles.button, (loading || isPremium) && styles.buttonDisabled]}
        onPress={onSubscribe}
        disabled={loading || isPremium}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isPremium ? 'Tashmë Premium' : 'Upgrade tani'}</Text>
        )}
      </TouchableOpacity>

      {pendingSessionId && !isPremium ? (
        <TouchableOpacity style={styles.verifyBtn} onPress={onVerifyPayment} disabled={loading}>
          <Text style={styles.verifyBtnText}>Kam përfunduar pagesën</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.footer}>
        Pagesa me Stripe kur është konfiguruar në server. Pa Stripe, aktivizohet automatikisht (demo).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 14, paddingBottom: 36 },
  hero: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 6, fontSize: 15 },
  statusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  active: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  inactive: { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' },
  statusTitle: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  statusText: { color: '#334155', marginTop: 4, lineHeight: 20 },
  planToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#0f766e' },
  toggleText: { fontWeight: '700', color: '#475569' },
  toggleTextActive: { color: '#fff' },
  planCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  planTitle: { color: '#0f172a', fontWeight: '800', fontSize: 18 },
  planPrice: { color: '#0f766e', fontWeight: '800', fontSize: 20, marginVertical: 8 },
  planBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  planBadgeText: { color: '#92400e', fontWeight: '700', fontSize: 12 },
  perk: { color: '#334155', marginBottom: 6, fontSize: 14 },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  verifyBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
  },
  verifyBtnText: { color: '#0f766e', fontWeight: '700' },
  footer: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
