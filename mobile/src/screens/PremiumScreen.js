import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

const plans = [
  {
    key: 'monthly',
    title: 'Monthly Premium',
    price: '$9.99/month',
    perks: ['Advanced analytics', 'Priority recommendations', 'Premium profile badge', 'Reduced ads'],
  },
  {
    key: 'yearly',
    title: 'Yearly Premium',
    price: '$99.99/year',
    perks: ['Everything in monthly', '2 months free', 'Exclusive tournaments', 'Early feature access'],
  },
];

export default function PremiumScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Premium</Text>
        <Text style={styles.heroSub}>Boost your football journey with premium tools.</Text>
      </View>

      <View style={[styles.statusCard, user?.premium ? styles.active : styles.inactive]}>
        <Text style={styles.statusTitle}>{user?.premium ? 'Premium Active' : 'Free Plan'}</Text>
        <Text style={styles.statusText}>
          {user?.premium
            ? `Your membership is active${user?.premiumExpiresAt ? ` until ${new Date(user.premiumExpiresAt).toLocaleDateString()}` : ''}.`
            : 'Upgrade to unlock all premium features.'}
        </Text>
      </View>

      {plans.map((plan) => (
        <View key={plan.key} style={styles.planCard}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.planPrice}>{plan.price}</Text>
          {plan.perks.map((perk) => (
            <Text key={`${plan.key}-${perk}`} style={styles.perk}>• {perk}</Text>
          ))}
          <TouchableOpacity style={styles.button} disabled={user?.isPremium}>
            <Text style={styles.buttonText}>{user?.isPremium ? 'Already Active' : 'Upgrade Soon'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 14, paddingBottom: 30 },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: '#cbd5e1', marginTop: 4 },
  statusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  active: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  inactive: { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' },
  statusTitle: { color: '#0f172a', fontWeight: '800' },
  statusText: { color: '#334155', marginTop: 4 },
  planCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  planTitle: { color: '#0f172a', fontWeight: '800', fontSize: 17 },
  planPrice: { color: '#0f766e', fontWeight: '700', marginVertical: 8 },
  perk: { color: '#334155', marginBottom: 4 },
  button: {
    marginTop: 10,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
