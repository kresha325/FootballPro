import React, { useMemo, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_BRAND_NAME } from '../config/branding';
import { WEB_APP_URL } from '../config/constants';
import { useTheme } from '../context/ThemeContext';

const WEB_BASE = (WEB_APP_URL || 'https://xtalenti.com').replace(/\/$/, '');

/** Fixed light-on-dark colors for brand hero surfaces (never remapped by theme). */
const ON_DARK = {
  text: '#FFFFFF',
  muted: '#CBD5E1',
  accent: '#FBBF24',
  surface: '#0F172A',
  surfaceDeep: '#020617',
  outline: 'rgba(255,255,255,0.3)',
  outlineFill: 'rgba(255,255,255,0.1)',
};

/** Free 30 ditë · Basic €5.99/muaj · Pro €11.99/muaj · vjetore = 10 muaj (2 muaj falas). */
const ROLE_GROUPS = {
  individual: {
    label: 'Lojtarë, Trajnerë & Skautë',
    roles: 'Atlet · Trajner · Skaut · Menaxher · Gjyqtar',
    plans: {
      social: { name: 'Free', price: 0, period: '30 ditë' },
      basic: { name: 'Basic', price: 5.99, period: '/muaj', yearly: 59.9 },
      pro: { name: 'Pro', price: 11.99, period: '/muaj', yearly: 119.9 },
    },
  },
  organization: {
    label: 'Klube, Federata & Media',
    roles: 'Klub · Federatë · Ligë · Media · Biznes',
    plans: {
      social: { name: 'Free', price: 0, period: '30 ditë' },
      basic: { name: 'Basic', price: 5.99, period: '/muaj', yearly: 59.9 },
      pro: { name: 'Pro', price: 11.99, period: '/muaj', yearly: 119.9 },
    },
  },
};

const FEATURE_MATRIX = [
  { label: 'Profil publik & feed', social: true, basic: true, pro: true },
  { label: 'Postime foto & video', social: true, basic: true, pro: true },
  { label: 'Mesazhe & bashkëbisedim', social: true, basic: true, pro: true },
  { label: 'Pjesëmarrje në turne', social: true, basic: true, pro: true },
  { label: 'Badge i verifikuar', social: false, basic: true, pro: true },
  { label: 'Analitika e avancuar e profilit', social: false, basic: true, pro: true },
  { label: 'Video highlights (deri 10)', social: false, basic: true, pro: true },
  { label: 'Rekomandime prioritare nga skautët', social: false, basic: false, pro: true },
  { label: 'Live streaming pa limit', social: false, basic: false, pro: true },
  { label: 'Tema të personalizuara profili', social: false, basic: false, pro: true },
  { label: 'Akses i hershëm në features të reja', social: false, basic: false, pro: true },
  { label: 'Suport prioritar', social: false, basic: false, pro: true },
];

const FEATURES = [
  { icon: 'football-outline', title: 'Profil Lojtari', desc: 'Krijo profilin tënd me statistika, video highlights dhe historikun e transfertave.' },
  { icon: 'search-outline', title: 'Skautim', desc: 'Skautët dhe klubet zbulojnë talente të reja përmes kërkimit dhe rekomandimeve.' },
  { icon: 'trophy-outline', title: 'Turne & Ndeshje', desc: 'Merr pjesë në turne, ndiq rezultatet dhe ndërto historikun tënd të karrierës.' },
  { icon: 'radio-outline', title: 'Live Streaming', desc: 'Transmeto ndeshje live dhe lejo ndjekësit e klubet të të shohin në kohë reale.' },
  { icon: 'chatbubbles-outline', title: 'Mesazhe & Rrjetëzim', desc: 'Komunikohu direkt me klube, trajnerë dhe skautë të interesuar.' },
  { icon: 'stats-chart-outline', title: 'Analitikë', desc: 'Analizo performancën, angazhimin e profilit dhe progresin tënd me kohë.' },
  { icon: 'cart-outline', title: 'Treg (Marketplace)', desc: 'Bli e shit produkte sportive direkt në platformë.' },
  { icon: 'game-controller-outline', title: 'Gamifikim', desc: 'Fito XP, arritje dhe ngjitu në renditje ndërsa përdor platformën.' },
];

const ROLES = [
  { icon: 'football-outline', label: 'Lojtarë (Atletë)' },
  { icon: 'people-outline', label: 'Trajnerë' },
  { icon: 'search-outline', label: 'Skautë' },
  { icon: 'clipboard-outline', label: 'Menaxherë' },
  { icon: 'flag-outline', label: 'Gjyqtarë' },
  { icon: 'business-outline', label: 'Klube' },
  { icon: 'globe-outline', label: 'Federata & Liga' },
  { icon: 'tv-outline', label: 'Media' },
  { icon: 'briefcase-outline', label: 'Biznese Sportive' },
];

const STEPS = [
  { step: '1', title: 'Krijo Llogarinë', desc: 'Kliko "Regjistrohu Falas" dhe zgjidh rolin tënd (lojtar, trajner, klub etj.).' },
  { step: '2', title: 'Plotëso Profilin', desc: 'Shto informacionet, fotot dhe videot që tregojnë talentin tënd.' },
  { step: '3', title: 'Fillo Të Lidhesh', desc: 'Postimet, mesazhet dhe skautimi fillojnë menjëherë — falas.' },
];

function BrandMark({ textColor }) {
  const rest = APP_BRAND_NAME.replace(/^x/i, '').trim() || 'Talenti';
  return (
    <Text style={styles.brandMark}>
      <Text style={styles.brandX}>X</Text>
      <Text style={[styles.brandRest, textColor ? { color: textColor } : null]}>{rest}</Text>
    </Text>
  );
}

export default function LandingScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const scrollRef = useRef(null);
  const [pricingY, setPricingY] = useState(0);
  const [roleGroup, setRoleGroup] = useState('individual');
  const group = ROLE_GROUPS[roleGroup];
  const year = useMemo(() => new Date().getFullYear(), []);

  const goLogin = () => navigation.navigate('Login', { mode: 'login' });
  const goRegister = () => navigation.navigate('Login', { mode: 'register' });
  const scrollToPricing = () => {
    if (scrollRef.current && pricingY > 0) {
      scrollRef.current.scrollTo({ y: Math.max(0, pricingY - 12), animated: true });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.nav,
          {
            paddingTop: insets.top,
            backgroundColor: isDark ? colors.header : 'rgba(255,255,255,0.96)',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.navInner}>
          <BrandMark textColor={colors.text} />
          <TouchableOpacity
            style={[styles.navCta, { backgroundColor: ON_DARK.surface }]}
            onPress={goLogin}
            activeOpacity={0.85}
          >
            <Text style={[styles.navCtaText, { color: ON_DARK.text }]}>Hyr</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        nestedScrollEnabled
      >
        <View style={[styles.hero, { backgroundColor: ON_DARK.surface }]}>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: ON_DARK.accent }]}>Platforma #1 për talente futbolli</Text>
          </View>
          <Text style={[styles.heroTitle, { color: ON_DARK.text }]}>
            Zbulo. Zhvillo. <Text style={[styles.heroAccent, { color: ON_DARK.accent }]}>Shko Më Tej.</Text>
          </Text>
          <Text style={[styles.heroBody, { color: ON_DARK.muted }]}>
            {APP_BRAND_NAME} lidh lojtarët, trajnerët, skautët dhe klubet në një platformë të vetme — për të ndarë
            talentin, për t'u zbuluar dhe për të ndërtuar karrierën në futboll.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goRegister} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Regjistrohu Falas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { borderColor: ON_DARK.outline, backgroundColor: ON_DARK.outlineFill },
            ]}
            onPress={scrollToPricing}
            activeOpacity={0.9}
          >
            <Text style={[styles.secondaryBtnText, { color: ON_DARK.text }]}>Shiko Çmimet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Çka Është {APP_BRAND_NAME}?</Text>
          <Text style={[styles.sectionBody, { color: colors.muted }]}>
            {APP_BRAND_NAME} është një rrjet social i dedikuar botës së futbollit. E krijuar për lojtarë të rinj që
            duan të tregojnë talentin e tyre, për trajnerë e skautë që kërkojnë lojtarë të rinj, dhe për klube e
            federata që duan të organizojnë e menaxhojnë talentet e tyre — të gjithë në një vend.
          </Text>
        </View>

        <View style={[styles.featuresBand, { backgroundColor: colors.bgElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Çka Mund Të Bësh</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View
                key={f.title}
                style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name={f.icon} size={26} color="#F59E0B" style={styles.featureIcon} />
                <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.muted }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => setPricingY(e.nativeEvent.layout.y)}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Çmimet</Text>
          <Text style={[styles.sectionBody, styles.pricingIntro, { color: colors.muted }]}>
            Zgjidh paketën që i përshtatet rolit tënd në futboll.
          </Text>

          <View style={[styles.toggle, { backgroundColor: colors.bgElevated }]}>
            {Object.entries(ROLE_GROUPS).map(([key, g]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.toggleBtn,
                  roleGroup === key && [styles.toggleBtnActive, { backgroundColor: colors.card }],
                ]}
                onPress={() => setRoleGroup(key)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: colors.muted },
                    roleGroup === key && styles.toggleTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.rolesHint, { color: colors.mutedSoft }]}>{group.roles}</Text>

          {['social', 'basic', 'pro'].map((planKey) => {
            const plan = group.plans[planKey];
            const isPro = planKey === 'pro';
            const included = FEATURE_MATRIX.filter((f) => f[planKey]);
            return (
              <View
                key={planKey}
                style={[
                  styles.planCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isPro && {
                    borderColor: '#F59E0B',
                    backgroundColor: ON_DARK.surface,
                  },
                ]}
              >
                {isPro ? (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Më Popullorja</Text>
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.planName,
                    { color: colors.text },
                    isPro && { color: ON_DARK.accent },
                  ]}
                >
                  {plan.name}
                </Text>
                <Text
                  style={[
                    styles.planPrice,
                    { color: colors.text },
                    isPro && { color: ON_DARK.text },
                  ]}
                >
                  {plan.price === 0 ? 'Falas' : `€${plan.price}`}
                  <Text
                    style={[
                      styles.planPeriod,
                      { color: colors.muted },
                      isPro && { color: ON_DARK.muted },
                    ]}
                  >
                    {' '}
                    {plan.period}
                  </Text>
                </Text>
                {plan.yearly ? (
                  <Text
                    style={[
                      styles.planYearly,
                      { color: colors.muted },
                      isPro && { color: ON_DARK.muted },
                    ]}
                  >
                    ose €{plan.yearly}/vit · 2 muaj falas
                  </Text>
                ) : null}
                {included.slice(0, 6).map((f) => (
                  <View key={f.label} style={styles.planRow}>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={isPro ? '#FBBF24' : '#10B981'}
                      style={styles.planCheck}
                    />
                    <Text
                      style={[
                        styles.planFeature,
                        { color: colors.textSecondary },
                        isPro && { color: '#E2E8F0' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.planCta, isPro ? styles.planCtaPro : styles.planCtaDefault]}
                  onPress={goRegister}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.planCtaText, isPro ? styles.planCtaTextPro : styles.planCtaTextDefault]}>
                    {plan.price === 0 ? 'Fillo Falas' : 'Regjistrohu'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={[styles.featuresBand, { backgroundColor: colors.bgElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Kush Mund Të Regjistrohet</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <View
                key={r.label}
                style={[styles.roleChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Ionicons name={r.icon} size={20} color="#F59E0B" style={styles.roleIcon} />
                <Text style={[styles.roleLabel, { color: colors.text }]}>{r.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Si Të Regjistrohesh</Text>
          {STEPS.map((s) => (
            <View key={s.step} style={styles.stepBlock}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{s.step}</Text>
              </View>
              <Text style={[styles.stepTitle, { color: colors.text }]}>{s.title}</Text>
              <Text style={[styles.stepDesc, { color: colors.muted }]}>{s.desc}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.primaryBtn} onPress={goRegister} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Regjistrohu Tani</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.contact, { backgroundColor: ON_DARK.surface }]}>
          <Text style={[styles.contactTitle, { color: ON_DARK.text }]}>Kontakti</Text>
          <Text style={[styles.contactBody, { color: ON_DARK.muted }]}>
            Ke pyetje? Na kontakto dhe do të përgjigjemi sa më shpejt.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => Linking.openURL('mailto:support@xtalenti.com')}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>support@xtalenti.com</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { backgroundColor: ON_DARK.surfaceDeep }]}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/help`)}>
              <Text style={styles.footerLink}>Ndihmë</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/privacy`)}>
              <Text style={styles.footerLink}>Privatësia</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/terms`)}>
              <Text style={styles.footerLink}>Kushtet</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/data`)}>
              <Text style={styles.footerLink}>Të dhënat</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerText}>
            © {year} {APP_BRAND_NAME}. Të gjitha të drejtat e rezervuara.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  nav: {
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  navInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandMark: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  brandX: { color: '#F59E0B' },
  brandRest: { color: '#0F172A' },
  navCta: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  scrollView: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 8 },
  hero: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 18,
  },
  badgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 14,
  },
  heroAccent: { color: '#FBBF24' },
  heroBody: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 520,
  },
  primaryBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  section: { paddingHorizontal: 20, paddingVertical: 36, alignItems: 'center' },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 14,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    textAlign: 'center',
  },
  featuresBand: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 36,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  featureIcon: { marginBottom: 8 },
  featureTitle: { fontWeight: '700', fontSize: 15, color: '#0F172A', marginBottom: 6 },
  featureDesc: { fontSize: 13, lineHeight: 18, color: '#64748B' },
  pricingIntro: { marginBottom: 18 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
    width: '100%',
  },
  toggleBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  toggleText: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#F59E0B' },
  rolesHint: { color: '#94A3B8', fontSize: 13, marginBottom: 18, textAlign: 'center' },
  planCard: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  planCardPro: {
    borderColor: '#F59E0B',
    backgroundColor: '#0F172A',
  },
  popularBadge: {
    alignSelf: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
    marginTop: -4,
  },
  popularBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  planName: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  planNamePro: { color: '#FBBF24' },
  planPrice: { fontSize: 34, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  planPricePro: { color: '#FFFFFF' },
  planPeriod: { fontSize: 15, fontWeight: '500', color: '#64748B' },
  planPeriodPro: { color: '#CBD5E1' },
  planYearly: { fontSize: 13, fontWeight: '600', marginBottom: 12, lineHeight: 18 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  planCheck: { marginRight: 8, marginTop: 1 },
  planFeature: { flex: 1, color: '#334155', fontSize: 14, lineHeight: 20 },
  planFeaturePro: { color: '#E2E8F0' },
  planCta: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  planCtaDefault: { backgroundColor: '#0F172A' },
  planCtaPro: { backgroundColor: '#F59E0B' },
  planCtaText: { fontWeight: '800', fontSize: 15 },
  planCtaTextDefault: { color: '#FFFFFF' },
  planCtaTextPro: { color: '#0F172A' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  roleChip: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  roleIcon: { marginRight: 10 },
  roleLabel: { flex: 1, fontWeight: '600', color: '#0F172A', fontSize: 13 },
  stepBlock: { alignItems: 'center', marginBottom: 22, width: '100%' },
  stepCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepNumber: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  stepTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  stepDesc: { fontSize: 14, lineHeight: 20, color: '#64748B', textAlign: 'center' },
  contact: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  contactTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  contactBody: { color: '#CBD5E1', fontSize: 15, textAlign: 'center', marginBottom: 18, lineHeight: 22 },
  footer: { backgroundColor: '#020617', paddingVertical: 24, paddingHorizontal: 16 },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 12,
  },
  footerLink: { color: '#FBBF24', fontSize: 13, fontWeight: '700' },
  footerText: { color: '#94A3B8', textAlign: 'center', fontSize: 13 },
});
