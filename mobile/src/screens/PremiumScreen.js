import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  extractErrorMessage,
  premiumCheckoutRequest,
  premiumVerifySessionRequest,
  publicConfigRequest,
} from '../api/client';
import { WEB_APP_URL, ALLOW_MOBILE_DIGITAL_PURCHASES } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { purchaseAndFulfill, loadIapProducts, restorePremiumPurchases } from '../iap/purchase';
import { premiumSkuForPlan } from '../iap/products';

const PENDING_SESSION_KEY = 'premium_checkout_session_id';

const plans = [
  {
    key: 'monthly',
    title: 'Pro mujor',
    price: '€11.99 / muaj',
    perks: ['Analitika e avancuar', 'Rekomandime prioritare', 'Badge Pro', 'Më pak reklama'],
  },
  {
    key: 'yearly',
    title: 'Pro vjetor',
    price: '€119.90 / vit',
    badge: '2 muaj falas',
    perks: ['Gjithçka nga mujori', '2 muaj falas', 'Turne ekskluzive', 'Akses i hershëm'],
  },
];

export default function PremiumScreen() {
  const { t } = useLocale();
  const { user, refreshMe } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [paymentsLive, setPaymentsLive] = useState(false);
  const [storePrices, setStorePrices] = useState({});

  useEffect(() => {
    publicConfigRequest()
      .then((res) => setPaymentsLive(!!res.data?.paymentsEnabled && res.data?.premiumMode === 'stripe'))
      .catch(() => setPaymentsLive(false));
  }, []);

  useEffect(() => {
    if (!ALLOW_MOBILE_DIGITAL_PURCHASES) return;
    loadIapProducts()
      .then(({ subscriptions }) => {
        const map = {};
        (subscriptions || []).forEach((p) => {
          const id = p?.id || p?.productId;
          if (id) map[id] = p.displayPrice || p.localizedPrice || p.price;
        });
        setStorePrices(map);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    AsyncStorage.getItem(PENDING_SESSION_KEY).then((id) => {
      if (id) setPendingSessionId(id);
    });
  }, []);

  const onSubscribe = useCallback(async () => {
    if (user?.premium) return;

    if (ALLOW_MOBILE_DIGITAL_PURCHASES) {
      setLoading(true);
      try {
        const sku = premiumSkuForPlan(selectedPlan);
        await purchaseAndFulfill(sku, { type: 'subs' });
        await refreshMe();
        Alert.alert(t('Premium aktiv'), t('Abonimi u aktivizua përmes App Store / Play.'));
      } catch (err) {
        if (err?.cancelled) return;
        Alert.alert(t('Gabim'), extractErrorMessage(err, err?.message || t('Blerja IAP dështoi')));
      } finally {
        setLoading(false);
      }
      return;
    }

    Alert.alert(
      t('Premium'),
      t('Blerja e Premium në app kërkon IAP. Mund ta aktivizosh demo nëse pagesat janë fikur, ose nga web.'),
      [
        { text: t('Hap web'), onPress: () => Linking.openURL(`${WEB_APP_URL}/premium`).catch(() => {}) },
        {
          text: t('Provo demo'),
          onPress: async () => {
            setLoading(true);
            try {
              const { data } = await premiumCheckoutRequest(selectedPlan);
              if (data.mode === 'demo' && data.success) {
                await refreshMe();
                Alert.alert(t('Premium aktiv'), data.message || t('Llogaria jote është Premium (demo).'));
              } else {
                Alert.alert(t('Jo e disponueshme'), t('Pagesat digjitale në mobile janë të çaktivizuara.'));
              }
            } catch (err) {
              Alert.alert(t('Gabim'), extractErrorMessage(err, t('Nuk u aktivizua Premium')));
            } finally {
              setLoading(false);
            }
          },
        },
        { text: t('Anulo'), style: 'cancel' },
      ]
    );
  }, [user?.premium, selectedPlan, refreshMe, t]);

  const onVerifyPayment = useCallback(async () => {
    const sessionId = pendingSessionId;
    if (!sessionId) {
      Alert.alert(t('Verifikim'), t('Nuk ka sesion pagese në pritje. Nis upgrade përsëri.'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await premiumVerifySessionRequest(sessionId);
      if (data.success) {
        await AsyncStorage.removeItem(PENDING_SESSION_KEY);
        setPendingSessionId(null);
        await refreshMe();
        Alert.alert(t('Sukses'), t('Premium u aktivizua!'));
      } else {
        Alert.alert(
          t('Në pritje'),
          t('Pagesa nuk është konfirmuar ende. Provo përsëri pas disa sekondash.')
        );
      }
    } catch (err) {
      Alert.alert(t('Gabim'), extractErrorMessage(err, t('Verifikimi dështoi')));
    } finally {
      setLoading(false);
    }
  }, [pendingSessionId, refreshMe, t]);

  const onRestore = useCallback(async () => {
    if (!ALLOW_MOBILE_DIGITAL_PURCHASES) {
      Alert.alert(t('Restore'), t('Restore është i disponueshëm vetëm me IAP në këtë build.'));
      return;
    }
    setLoading(true);
    try {
      const { restored } = await restorePremiumPurchases();
      await refreshMe();
      if (restored > 0) {
        Alert.alert(t('U rikthye'), t('Abonimi Premium u rikthye nga App Store / Play.'));
      } else {
        Alert.alert(t('Asnjë blerje'), t('Nuk u gjet asnjë abonim aktiv Premium për këtë llogari store.'));
      }
    } catch (err) {
      Alert.alert(t('Gabim'), extractErrorMessage(err, err?.message || t('Restore dështoi')));
    } finally {
      setLoading(false);
    }
  }, [refreshMe, t]);

  const isPremium = !!user?.premium;
  const selectedSku = premiumSkuForPlan(selectedPlan);
  const displayPrice = storePrices[selectedSku];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('Go Premium')}</Text>
        <Text style={styles.heroSub}>{t('Zhblloko mjetet premium për karrierën tënde.')}</Text>
      </View>

      {ALLOW_MOBILE_DIGITAL_PURCHASES ? (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerTitle}>{t('In-App Purchase')}</Text>
          <Text style={styles.demoBannerText}>
            {t('Pagesa bëhet përmes App Store / Google Play. Kërkon build me expo-iap (jo Expo Go).')}
          </Text>
        </View>
      ) : !paymentsLive ? (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerTitle}>{t('Pagesat jo aktive')}</Text>
          <Text style={styles.demoBannerText}>
            {t('Premium aktivizohet në mënyrë demo (pa kartë) ose nga web.')}
          </Text>
        </View>
      ) : (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerTitle}>{t('Stripe (web)')}</Text>
          <Text style={styles.demoBannerText}>
            {t('Pagesa hapet në shfletues kur IAP nuk është i aktivizuar.')}
          </Text>
        </View>
      )}

      <View style={[styles.statusCard, isPremium ? styles.active : styles.inactive]}>
        <Text style={styles.statusTitle}>{isPremium ? t('Premium aktiv') : t('Plani falas')}</Text>
        <Text style={styles.statusText}>
          {isPremium
            ? t('Ke akses në të gjitha përfitimet Premium.')
            : t('Zgjidh një plan dhe aktivizo Premium.')}
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
              {p.key === 'monthly' ? t('Mujor') : t('Vjetor')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {plans
        .filter((p) => p.key === selectedPlan)
        .map((plan) => (
          <View key={plan.key} style={styles.planCard}>
            <Text style={styles.planTitle}>{t(plan.title)}</Text>
            <Text style={styles.planPrice}>{displayPrice || plan.price.replace('/ muaj', t('/muaj'))}</Text>
            {plan.badge ? (
              <View style={styles.planBadgeWrap}>
                <Text style={styles.planBadgeText}>{t(plan.badge)}</Text>
              </View>
            ) : null}
            {plan.perks.map((perk) => (
              <Text key={`${plan.key}-${t(perk)}`} style={styles.perk}>
                ✓ {t(perk)}
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
          <Text style={styles.buttonText}>
            {isPremium
              ? t('Tashmë Premium')
              : ALLOW_MOBILE_DIGITAL_PURCHASES
                ? t('Bli me App Store / Play')
                : paymentsLive
                  ? t('Upgrade tani')
                  : t('Aktivizo Premium (demo)')}
          </Text>
        )}
      </TouchableOpacity>

      {!ALLOW_MOBILE_DIGITAL_PURCHASES && paymentsLive && pendingSessionId && !isPremium ? (
        <TouchableOpacity style={styles.verifyBtn} onPress={onVerifyPayment} disabled={loading}>
          <Text style={styles.verifyBtnText}>{t('Kam përfunduar pagesën')}</Text>
        </TouchableOpacity>
      ) : null}

      {ALLOW_MOBILE_DIGITAL_PURCHASES ? (
        <TouchableOpacity style={styles.verifyBtn} onPress={onRestore} disabled={loading}>
          <Text style={styles.verifyBtnText}>{t('Rikthe blerjet (Restore)')}</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.footer}>
        {ALLOW_MOBILE_DIGITAL_PURCHASES
          ? t('Abonimi menaxhohet nga Apple/Google. Anulo nga Settings të pajisjes.')
          : t('Pagesa me Stripe kur është konfiguruar në server. Pa Stripe, aktivizohet automatikisht (demo).')}
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
  demoBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  demoBannerTitle: { color: '#92400e', fontWeight: '800', marginBottom: 4 },
  demoBannerText: { color: '#78350f', fontSize: 13, lineHeight: 18 },
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
  toggleBtnActive: { backgroundColor: '#9A6B12' },
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
  planPrice: { color: '#9A6B12', fontWeight: '800', fontSize: 20, marginVertical: 8 },
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
    borderColor: '#9A6B12',
    borderRadius: 10,
  },
  verifyBtnText: { color: '#9A6B12', fontWeight: '700' },
  footer: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
