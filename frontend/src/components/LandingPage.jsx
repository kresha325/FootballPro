import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { APP_BRAND_NAME } from '../config/branding';

// Grupe rolesh për çmimet — individë (lojtarë/trajnerë/skautë/etj.) kanë
// pricing të ndryshëm nga organizatat (klube/federata/media/biznese).
const ROLE_GROUPS = {
  individual: {
    label: 'Lojtarë, Trajnerë & Skautë',
    roles: 'Atlet · Trajner · Skaut · Menaxher · Gjyqtar',
    plans: {
      social: { name: 'Social', price: 0, period: 'përgjithmonë' },
      basic: { name: 'Basic', price: 4.99, period: '/muaj' },
      pro: { name: 'Pro', price: 9.99, period: '/muaj' },
    },
  },
  organization: {
    label: 'Klube, Federata & Media',
    roles: 'Klub · Federatë · Ligë · Media · Biznes',
    plans: {
      social: { name: 'Social', price: 0, period: 'përgjithmonë' },
      basic: { name: 'Basic', price: 19.99, period: '/muaj' },
      pro: { name: 'Pro', price: 49.99, period: '/muaj' },
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

function FeatureCell({ included }) {
  return included ? (
    <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
  ) : (
    <XMarkIcon className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
  );
}

export default function LandingPage() {
  const [roleGroup, setRoleGroup] = useState('individual');
  const group = ROLE_GROUPS[roleGroup];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <span className="text-2xl font-extrabold uppercase tracking-wide flex items-baseline gap-0.5">
            <span className="text-amber-500 dark:text-amber-400">X</span>
            <span className="text-slate-900 dark:text-white">{APP_BRAND_NAME.replace(/^x/i, '').trim()}</span>
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#rreth" className="hover:text-amber-500 transition-colors">Rreth Nesh</a>
            <a href="#features" className="hover:text-amber-500 transition-colors">Çka Mund Të Bësh</a>
            <a href="#cmimet" className="hover:text-amber-500 transition-colors">Çmimet</a>
            <a href="#kontakt" className="hover:text-amber-500 transition-colors">Kontakti</a>
          </div>

          <Link
            to="/login"
            className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-900 font-bold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Hyr
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28 text-center">
          <span className="inline-block bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            Platforma #1 për talente futbolli
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Zbulo. Zhvillo. <span className="text-amber-400">Shko Më Tej.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            {APP_BRAND_NAME} lidh lojtarët, trajnerët, skautët dhe klubet në një platformë të vetme —
            për të ndarë talentin, për t'u zbuluar dhe për të ndërtuar karrierën në futboll.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-3 rounded-lg shadow-lg transition-colors w-full sm:w-auto"
            >
              Regjistrohu Falas
            </Link>
            <a
              href="#cmimet"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-3 rounded-lg transition-colors w-full sm:w-auto"
            >
              Shiko Çmimet
            </a>
          </div>
        </div>
      </section>

      {/* RRETH NESH */}
      <section id="rreth" className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-6">Çka Është {APP_BRAND_NAME}?</h2>
        <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          {APP_BRAND_NAME} është një rrjet social i dedikuar botës së futbollit. E krijuar për lojtarë të rinj që
          duan të tregojnë talentin e tyre, për trajnerë e skautë që kërkojnë lojtarë të rinj, dhe për klube e
          federata që duan të organizojnë e menaxhojnë talentet e tyre — të gjithë në një vend.
        </p>
      </section>

      {/* ÇKA MUND TË BËSH */}
      <section id="features" className="bg-gray-50 dark:bg-gray-900 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-14">Çka Mund Të Bësh</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '⚽', title: 'Profil Lojtari', desc: 'Krijo profilin tënd me statistika, video highlights dhe historikun e transfertave.' },
              { icon: '🔍', title: 'Skautim', desc: 'Skautët dhe klubet zbulojnë talente të reja përmes kërkimit dhe rekomandimeve.' },
              { icon: '🏆', title: 'Turne & Ndeshje', desc: 'Merr pjesë në turne, ndiq rezultatet dhe ndërto historikun tënd të karrierës.' },
              { icon: '🔴', title: 'Live Streaming', desc: 'Transmeto ndeshje live dhe lejo ndjekësit e klubet të të shohin në kohë reale.' },
              { icon: '💬', title: 'Mesazhe & Rrjetëzim', desc: 'Komunikohu direkt me klube, trajnerë dhe skautë të interesuar.' },
              { icon: '📊', title: 'Analitikë', desc: 'Analizo performancën, angazhimin e profilit dhe progresin tënd me kohë.' },
              { icon: '🛒', title: 'Treg (Marketplace)', desc: 'Bli e shit produkte sportive direkt në platformë.' },
              { icon: '🎮', title: 'Gamifikim', desc: 'Fito XP, arritje dhe ngjitu në renditje ndërsa përdor platformën.' },
            ].map((f) => (
              <div key={f.title} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÇMIMET */}
      <section id="cmimet" className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">Çmimet</h2>
        <p className="text-center text-slate-600 dark:text-slate-300 mb-10">
          Zgjidh paketën që i përshtatet rolit tënd në futboll.
        </p>

        {/* Toggle role group */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {Object.entries(ROLE_GROUPS).map(([key, g]) => (
              <button
                key={key}
                onClick={() => setRoleGroup(key)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  roleGroup === key
                    ? 'bg-white dark:bg-gray-700 shadow text-amber-500'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mb-10">{group.roles}</p>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-14">
          {['social', 'basic', 'pro'].map((planKey) => {
            const plan = group.plans[planKey];
            const isPro = planKey === 'pro';
            return (
              <div
                key={planKey}
                className={`rounded-2xl p-8 border-2 relative ${
                  isPro
                    ? 'border-amber-500 bg-slate-900 text-white shadow-2xl scale-105'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs font-bold uppercase px-3 py-1 rounded-full">
                    Më Popullorja
                  </span>
                )}
                <h3 className={`text-xl font-bold mb-1 ${isPro ? 'text-amber-400' : ''}`}>{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">
                    {plan.price === 0 ? 'Falas' : `€${plan.price}`}
                  </span>
                  {plan.price !== 0 && (
                    <span className={isPro ? 'text-slate-300' : 'text-slate-500'}> {plan.period}</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 text-sm">
                  {FEATURE_MATRIX.filter((f) => f[planKey]).map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      <CheckIcon className={`w-5 h-5 shrink-0 ${isPro ? 'text-amber-400' : 'text-emerald-500'}`} />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center font-bold px-6 py-3 rounded-lg transition-colors ${
                    isPro
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                      : 'bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-900'
                  }`}
                >
                  {plan.price === 0 ? 'Fillo Falas' : 'Regjistrohu'}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Comparison table (desktop) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 font-semibold">Feature</th>
                <th className="py-3 font-semibold text-center">Social</th>
                <th className="py-3 font-semibold text-center">Basic</th>
                <th className="py-3 font-semibold text-center">Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((f) => (
                <tr key={f.label} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3">{f.label}</td>
                  <td className="py-3"><FeatureCell included={f.social} /></td>
                  <td className="py-3"><FeatureCell included={f.basic} /></td>
                  <td className="py-3"><FeatureCell included={f.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* KUSH MUND TË REGJISTROHET */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-10">Kush Mund Të Regjistrohet</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '⚽', label: 'Lojtarë (Atletë)' },
              { icon: '🧑‍🏫', label: 'Trajnerë' },
              { icon: '🔍', label: 'Skautë' },
              { icon: '📋', label: 'Menaxherë' },
              { icon: '🟨', label: 'Gjyqtarë' },
              { icon: '🏟️', label: 'Klube' },
              { icon: '🏛️', label: 'Federata & Liga' },
              { icon: '📺', label: 'Media' },
              { icon: '💼', label: 'Biznese Sportive' },
            ].map((r) => (
              <div
                key={r.label}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 flex items-center gap-3 shadow-sm"
              >
                <span className="text-2xl">{r.icon}</span>
                <span className="font-semibold">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SI TË REGJISTROHESH */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-14">Si Të Regjistrohesh</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Krijo Llogarinë', desc: 'Kliko "Regjistrohu Falas" dhe zgjidh rolin tënd (lojtar, trajner, klub etj.).' },
            { step: '2', title: 'Plotëso Profilin', desc: 'Shto informacionet, fotot dhe videot që tregojnë talentin tënd.' },
            { step: '3', title: 'Fillo Të Lidhesh', desc: 'Postimet, mesazhet dhe skautimi fillojnë menjëherë — falas.' },
          ].map((s) => (
            <div key={s.step}>
              <div className="w-14 h-14 rounded-full bg-amber-500 text-slate-900 font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{s.desc}</p>
            </div>
          ))}
        </div>
        <Link
          to="/register"
          className="inline-block mt-12 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-3 rounded-lg shadow-lg transition-colors"
        >
          Regjistrohu Tani
        </Link>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" className="bg-slate-900 text-white py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-extrabold mb-4">Kontakti</h2>
          <p className="text-slate-300 mb-6">
            Ke pyetje? Na kontakto dhe do të përgjigjemi sa më shpejt.
          </p>
          <a
            href="mailto:support@xtalenti.com"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-lg transition-colors"
          >
            support@xtalenti.com
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-8 text-center text-sm">
        <p>© {new Date().getFullYear()} {APP_BRAND_NAME}. Të gjitha të drejtat e rezervuara.</p>
      </footer>
    </div>
  );
}
