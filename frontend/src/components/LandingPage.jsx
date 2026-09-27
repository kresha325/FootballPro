import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownIcon, ArrowRightIcon, Bars3Icon, ChartBarIcon, ChatBubbleLeftRightIcon,
  CheckIcon, CircleStackIcon, ClipboardDocumentListIcon, CurrencyEuroIcon,
  MagnifyingGlassIcon, MapPinIcon, PlayIcon, TrophyIcon,
  UserGroupIcon, UserIcon, VideoCameraIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { APP_BRAND_NAME, APP_BRAND_WORDMARK, APP_LOGO_SRC, APP_HERO_DESKTOP, APP_HERO_DESKTOP_W, APP_HERO_DESKTOP_H, APP_HERO_MOBILE, APP_HERO_MOBILE_W, APP_HERO_MOBILE_H } from '../config/branding';
import './LandingPage.css';

// Existing public pricing configuration, preserved from the original landing page.
const ROLE_GROUPS = {
  individual: {
    label: 'Lojtarë, Trajnerë & Skautë', roles: 'Atlet · Trajner · Skaut · Menaxher · Gjyqtar',
    plans: { social: { name: 'Social', price: 0, period: 'përgjithmonë' }, basic: { name: 'Basic', price: 4.99, period: '/muaj' }, pro: { name: 'Pro', price: 9.99, period: '/muaj' } },
  },
  organization: {
    label: 'Klube, Federata & Media', roles: 'Klub · Federatë · Ligë · Media · Biznes',
    plans: { social: { name: 'Social', price: 0, period: 'përgjithmonë' }, basic: { name: 'Basic', price: 19.99, period: '/muaj' }, pro: { name: 'Pro', price: 49.99, period: '/muaj' } },
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

const features = [
  [UserIcon, 'Lojtarë', 'Ndërto profilin, ndaj performancën dhe bëj talentin tënd të dukshëm.'],
  [UserGroupIcon, 'Klube', 'Menaxho lojtarët dhe zbulo profile që përputhen me nevojat e ekipit.'],
  [MagnifyingGlassIcon, 'Skautë', 'Kërko, filtro dhe mbaj shënim talentet në një hapësirë të vetme.'],
  [ClipboardDocumentListIcon, 'Trajnerë', 'Ndaj përvojën dhe ndihmo lojtarët të zhvillohen.'],
  [TrophyIcon, 'Turne', 'Organizo pjesëmarrjen dhe ndërto historikun e ndeshjeve.'],
  [PlayIcon, 'Ndeshje', 'Regjistro paraqitjet dhe ndiq momentet kryesore.'],
  [ChartBarIcon, 'Analitika', 'Kupto progresin dhe aktivitetin e profilit.'],
  [MapPinIcon, 'Mundësi', 'Lidhu me klubet dhe mundësitë e karrierës.'],
  [ChatBubbleLeftRightIcon, 'Mesazhe', 'Komuniko drejtpërdrejt me komunitetin e futbollit.'],
  [VideoCameraIcon, 'Video thirrje', 'Bisedo ballë për ballë përmes platformës.'],
  [CircleStackIcon, 'Marketplace', 'Eksploro tregun sportiv brenda platformës.'],
  [CurrencyEuroIcon, 'Wallet / XCoin', 'Qasju portofolit dhe shërbimeve të platformës.'],
];

const fade = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion();
  return <Motion.div className={className} variants={fade} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.14 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</Motion.div>;
}

function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return <div className={`mb-12 max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
    <p className="xt-eyebrow">{eyebrow}</p><h2 className="xt-heading">{title}</h2>{description && <p className="mt-4 text-base leading-7 text-[var(--xt-muted)] md:text-lg">{description}</p>}
  </div>;
}

export default function LandingPage() {
  const [roleGroup, setRoleGroup] = useState('individual');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const group = ROLE_GROUPS[roleGroup];

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const navLinks = [['Players', '#players'], ['Clubs', '#clubs'], ['Scouts', '#clubs'], ['Tournaments', '#tournaments'], ['Opportunities', '#features']];
  const closeMenu = () => setMenuOpen(false);

  return <div className="xt-site min-h-screen overflow-hidden">
    <header className={`xt-marketing-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 md:px-8 xl:px-12">
        <a href="#top" aria-label={APP_BRAND_NAME} className="flex shrink-0 items-center gap-2.5">
          <img src={APP_LOGO_SRC} alt="" width="42" height="42" className="h-10 w-10 object-contain" />
          <span className="text-[19px] font-black tracking-[.18em] text-white">{APP_BRAND_WORDMARK}</span>
        </a>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigimi kryesor">
          {navLinks.map(([label, href]) => <a key={label} href={href} className="xt-nav-link">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link to="/login" className="xt-login-link">Log In</Link>
          <Link to="/register" className="xt-button xt-button-gold !min-h-11 !px-5">Regjistrohu Falas</Link>
        </div>
        <button type="button" aria-label={menuOpen ? 'Mbyll menunë' : 'Hap menunë'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="xt-menu-button md:hidden">
          {menuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>
      {menuOpen && <nav className="xt-mobile-menu md:hidden" aria-label="Navigimi mobil">
        {navLinks.map(([label, href]) => <a key={label} href={href} onClick={closeMenu}>{label}<ArrowRightIcon className="h-4 w-4" /></a>)}
        <Link to="/login" onClick={closeMenu}>Log In</Link><Link to="/register" onClick={closeMenu} className="xt-button xt-button-gold">Regjistrohu Falas</Link>
      </nav>}
    </header>

    <main>
      <section id="top" className="xt-hero relative flex min-h-[760px] items-center overflow-hidden md:min-h-[780px] lg:min-h-[min(900px,100svh)]">
        <div className="absolute inset-0" aria-hidden="true">
          <picture className="absolute inset-0 block h-full w-full"><source media="(min-width: 768px)" srcSet={APP_HERO_DESKTOP} width={APP_HERO_DESKTOP_W} height={APP_HERO_DESKTOP_H} /><img src={APP_HERO_MOBILE} alt="" width={APP_HERO_MOBILE_W} height={APP_HERO_MOBILE_H} fetchPriority="high" decoding="async" className="h-full w-full object-cover object-[55%_center] md:object-center" /></picture>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,11,.96)_0%,rgba(5,7,11,.75)_45%,rgba(5,7,11,.2)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,11,.95)_0%,rgba(5,7,11,.78)_43%,rgba(5,7,11,.2)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#05070b_0%,transparent_30%,rgba(5,7,11,.15)_100%)]" />
          <div className="xt-hero-grain" />
        </div>
        <div className="relative z-10 mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 px-5 pb-28 pt-32 md:px-8 lg:grid-cols-[1.1fr_.9fr] lg:px-12 lg:pb-24 lg:pt-36">
          <div className="max-w-[720px]">
            <Reveal><span className="xt-hero-kicker"><span />TALENT HAS A FUTURE</span></Reveal>
            <Motion.h1 initial="hidden" animate="show" variants={stagger} className="mt-7 font-black leading-[.96] tracking-[-.055em] text-white">
              {['Zbulo.', 'Zhvillo.', 'Shko Më Tej.'].map((line, i) => <Motion.span key={line} variants={fade} transition={{ duration: .65, delay: i * .12 }} className={`block text-[clamp(3.65rem,10vw,7.7rem)] ${i === 2 ? 'text-[var(--xt-gold-bright)]' : ''}`}>{line}</Motion.span>)}
            </Motion.h1>
            <Reveal delay={0.25}><p className="mt-7 max-w-[560px] text-base leading-7 text-white/75 md:text-lg md:leading-8">Platforma digjitale që lidh talentet, klubet, skautët dhe mundësitë e futbollit në një ekosistem të vetëm.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="xt-button xt-button-gold">Regjistrohu Falas <ArrowRightIcon className="h-4 w-4" /></Link>
                <a href="#pricing" className="xt-button xt-button-outline">Shiko Çmimet</a>
              </div>
            </Reveal>
          </div>
          <Reveal className="hidden justify-end lg:flex" delay={0.35}>
            <div className="xt-hero-panel"><span className="xt-eyebrow">One connected game</span><h2>MORE THAN<br /><em>FOOTBALL</em></h2><div className="xt-hero-rules" />
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">{['PLAYERS', 'CLUBS', 'SCOUTS', 'TOURNAMENTS', 'OPPORTUNITIES'].map((item, i) => <div key={item} className={`xt-capability ${i === 4 ? 'col-span-2' : ''}`}><span>0{i + 1}</span>{item}</div>)}</div>
            </div>
          </Reveal>
        </div>
        <a href="#platform" aria-label="Vazhdo te platforma" className="xt-scroll-cue"><span>SCROLL TO DISCOVER</span><ArrowDownIcon className="h-4 w-4" /></a>
      </section>

      <section id="platform" className="xt-section xt-platform-section">
        <div className="xt-container">
          <div className="grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
            <Reveal><SectionHeading eyebrow="ONE PLATFORM · MANY POSSIBILITIES" title="Më shumë se një profil futbolli." description="X TALENTI krijon një hapësirë ku talenti mund të ndërtohet, prezantohet dhe zbulohet." /><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--xt-muted)]">PAMJE ILUSTRUESE E PLATFORMËS</p></Reveal>
            <Reveal delay={.12}><div className="xt-dashboard-preview">
              <div className="xt-preview-top"><div className="flex items-center gap-2"><span className="xt-dot" /><span className="xt-dot" /><span className="xt-dot" /></div><span className="text-xs tracking-[.12em] text-white/50">X TALENTI / PLAYER SPACE</span><span className="text-[10px] text-white/45">PREVIEW</span></div>
              <div className="grid gap-4 p-4 sm:grid-cols-[.82fr_1.18fr] sm:p-6">
                <div className="xt-preview-profile"><div className="xt-player-silhouette"><UserIcon className="h-12 w-12" /></div><span className="xt-preview-tag">PLAYER PROFILE</span><h3>Player Profile</h3><p>Profile · CV · Highlights</p><div className="xt-progress"><span /></div><small>PROFILE COMPLETION</small></div>
                <div className="grid grid-cols-2 gap-3">
                  {[[ChartBarIcon, 'Performance', 'Statistics & progress'], [PlayIcon, 'Matches', 'Match history'], [MagnifyingGlassIcon, 'Scouting', 'Player discovery'], [MapPinIcon, 'Opportunities', 'Career connections']].map(([_Icon, title, desc]) => <div key={title} className="xt-preview-tile"><_Icon className="h-5 w-5 text-[var(--xt-gold)]" /><h4>{title}</h4><p>{desc}</p><div className="xt-skeleton-line" /></div>)}
                  <div className="xt-preview-activity col-span-2"><span className="xt-live-mark" /> YOUR FOOTBALL JOURNEY, CONNECTED <ArrowRightIcon className="ml-auto h-4 w-4" /></div>
                </div>
              </div>
            </div></Reveal>
          </div>
        </div>
      </section>

      <section id="features" className="xt-section xt-feature-section"><div className="xt-container">
        <Reveal><SectionHeading eyebrow="BUILT AROUND THE GAME" title="Gjithçka që i duhet një talenti." description="Mjetet dhe lidhjet që e mbështesin çdo hap, nga profili i parë te mundësia e radhës." align="center" /></Reveal>
        <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: .08 }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map(([_Icon, title, description], i) => <Motion.article variants={fade} transition={{ duration: .45 }} key={title} className="xt-feature-card"><span className="xt-feature-index">{String(i + 1).padStart(2, '0')}</span><_Icon className="h-6 w-6 text-[var(--xt-gold)]" /><h3>{title}</h3><p>{description}</p><ArrowRightIcon className="xt-card-arrow h-4 w-4" /></Motion.article>)}
        </Motion.div>
      </div></section>

      <section id="players" className="xt-player-section"><div className="xt-player-image" aria-hidden="true" /><div className="xt-container relative z-10 grid items-center gap-8 py-24 md:py-32 lg:grid-cols-2">
        <Reveal><p className="xt-eyebrow">THE PLAYER JOURNEY</p><h2 className="xt-heading max-w-xl !text-white">Ktheje talentin<br /><span className="text-[var(--xt-gold-bright)]">në mundësi.</span></h2><p className="mt-5 max-w-lg leading-7 text-white/65">Prezantohu në mënyrën tënde dhe krijo një histori futbolli që klubet dhe skautët mund ta zbulojnë.</p><Link to="/register" className="xt-button xt-button-gold mt-8">Krijo profilin <ArrowRightIcon className="h-4 w-4" /></Link></Reveal>
        <Reveal delay={.12}><div className="xt-player-capabilities">{['Profili yt', 'CV dixhitale', 'Statistikat', 'Video highlights', 'Ndeshjet', 'Dukshmëri për skautët', 'Mundësi nga klubet', 'Mesazhe'].map((label, i) => <div key={label}><span>0{i + 1}</span>{label}<CheckIcon className="ml-auto h-4 w-4 text-[var(--xt-gold)]" /></div>)}</div></Reveal>
      </div></section>

      <section id="clubs" className="xt-section"><div className="xt-container">
        <Reveal><SectionHeading eyebrow="A SHARED NETWORK" title="Lidh njerëzit që e çojnë lojën përpara." description="Zbulimi dhe zhvillimi i talentit bëhen më të afërt kur klube, skautë dhe lojtarë takohen në të njëjtin ekosistem." /></Reveal>
        <div className="grid gap-4 md:grid-cols-2"><Reveal><article className="xt-audience-card xt-club-card"><span className="xt-audience-index">01 / FOR CLUBS</span><h3>Find and<br />manage talent.</h3><p>Player discovery · Profile · Statistics · Shortlisting</p><Link to="/register" aria-label="Regjistrohu si klub" className="xt-round-arrow"><ArrowRightIcon className="h-5 w-5" /></Link></article></Reveal>
          <Reveal delay={.12}><article className="xt-audience-card xt-scout-card"><span className="xt-audience-index">02 / FOR SCOUTS</span><h3>Discover the<br />next generation.</h3><p>Search · Filters · Communication · Opportunities</p><Link to="/register" aria-label="Regjistrohu si skaut" className="xt-round-arrow"><ArrowRightIcon className="h-5 w-5" /></Link></article></Reveal></div>
      </div></section>

      <section id="tournaments" className="xt-match-section"><div className="xt-container py-24 md:py-32"><Reveal><SectionHeading eyebrow="THE GAME IN MOTION" title="Çdo ndeshje tregon një histori." description="Turnetë, ndeshjet dhe paraqitjet krijojnë kontekst për rrugëtimin e çdo lojtari." /></Reveal>
        <div className="grid gap-3 md:grid-cols-3"><Reveal><article className="xt-match-card xt-match-primary"><TrophyIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>COMPETITION</span><h3>TOURNAMENTS</h3><p>Turne dhe pjesëmarrje</p></article></Reveal><Reveal delay={.08}><article className="xt-match-card"><PlayIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>ON THE PITCH</span><h3>MATCHES</h3><p>Ndeshje dhe histori</p></article></Reveal><Reveal delay={.16}><article className="xt-match-card"><ChartBarIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>PLAYER JOURNEY</span><h3>PERFORMANCE</h3><p>Statistika dhe progres</p></article></Reveal></div>
      </div></section>

      <section className="xt-ecosystem-section"><div className="xt-container py-20 md:py-24"><Reveal><SectionHeading eyebrow="MORE THAN FOOTBALL" title="Një ekosistem për lojën e plotë." description="Lidhje mes roleve dhe organizatave që formojnë futbollin." align="center" /></Reveal><Reveal><div className="xt-ecosystem">{['PLAYERS', 'CLUBS', 'SCOUTS', 'COACHES', 'AGENTS', 'FEDERATIONS', 'TOURNAMENTS'].map((label, i) => <span key={label}><i>0{i + 1}</i>{label}</span>)}</div></Reveal></div></section>

      <section id="pricing" className="xt-section xt-pricing-section"><div className="xt-container"><Reveal><SectionHeading eyebrow="CLEAR PLANS · REAL POSSIBILITIES" title="Gjej planin tënd të lojës." description="Zgjidh paketën që i përshtatet rolit tënd në futboll." align="center" /></Reveal>
        <div className="mb-5 flex justify-center"><div className="xt-plan-toggle" role="group" aria-label="Zgjidh llojin e llogarisë">{Object.entries(ROLE_GROUPS).map(([key, value]) => <button type="button" key={key} onClick={() => setRoleGroup(key)} aria-pressed={roleGroup === key} className={roleGroup === key ? 'active' : ''}>{value.label}</button>)}</div></div><p className="mb-9 text-center text-xs tracking-[.1em] text-[var(--xt-muted)]">{group.roles}</p>
        <div className="grid gap-3 lg:grid-cols-3">{['social', 'basic', 'pro'].map((planKey, index) => { const plan = group.plans[planKey]; const featured = planKey === 'pro'; return <Reveal key={planKey} delay={index * .06}><article className={`xt-plan-card ${featured ? 'featured' : ''}`}>
          {featured && <span className="xt-plan-ribbon">PRO</span>}<span className="xt-plan-label">{plan.name}</span><div className="xt-plan-price">{plan.price === 0 ? 'Falas' : <>€{plan.price}<small> {plan.period}</small></>}</div>
          <ul>{FEATURE_MATRIX.filter(feature => feature[planKey]).map(feature => <li key={feature.label}><CheckIcon className="h-4 w-4 shrink-0 text-[var(--xt-gold)]" />{feature.label}</li>)}</ul><Link to="/register" className={`xt-button ${featured ? 'xt-button-gold' : 'xt-button-outline'} w-full`}>{plan.price === 0 ? 'Fillo Falas' : 'Regjistrohu'}<ArrowRightIcon className="h-4 w-4" /></Link>
        </article></Reveal>; })}</div>
        <div className="mt-8 hidden overflow-hidden rounded-xl border border-white/10 md:block"><table className="xt-price-table"><thead><tr><th>Veçoria</th><th>Social</th><th>Basic</th><th>Pro</th></tr></thead><tbody>{FEATURE_MATRIX.map(feature => <tr key={feature.label}><td>{feature.label}</td>{['social', 'basic', 'pro'].map(key => <td key={key}>{feature[key] ? <CheckIcon className="mx-auto h-4 w-4 text-[var(--xt-gold)]" /> : <span aria-label="Nuk përfshihet">—</span>}</td>)}</tr>)}</tbody></table></div>
      </div></section>

      <section id="contact" className="xt-final-cta"><div className="xt-container py-20 text-center md:py-28"><Reveal><p className="xt-eyebrow justify-center">TALENT HAS A FUTURE</p><h2>Zbulo. Zhvillo.<br /><span>Shko Më Tej.</span></h2><p className="mx-auto mt-5 max-w-xl text-white/65">Futbolli yt meriton mundësi të reja. Fillo rrugëtimin në X TALENTI.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="xt-button xt-button-gold">Regjistrohu Falas <ArrowRightIcon className="h-4 w-4" /></Link><a href="#platform" className="xt-button xt-button-outline">Shiko Platformën</a></div></Reveal></div></section>
    </main>

    <footer className="xt-footer"><div className="xt-container"><div className="grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:py-16">
      <div><a href="#top" className="flex items-center gap-2"><img src={APP_LOGO_SRC} alt="" width="38" height="38" className="h-9 w-9 object-contain" /><span className="text-lg font-black tracking-[.18em] text-white">{APP_BRAND_WORDMARK}</span></a><p className="mt-4 max-w-xs text-sm leading-6 text-white/50">TALENT HAS A FUTURE<br />Zbulo. Zhvillo. Shko Më Tej.</p></div>
      <div><h3>Platform</h3><a href="#players">Players</a><a href="#clubs">Clubs</a><a href="#clubs">Scouts</a><a href="#tournaments">Tournaments</a><a href="#features">Opportunities</a></div>
      <div><h3>Company</h3><a href="#platform">About</a><a href="mailto:support@xtalenti.com">Contact</a><a href="#pricing">Pricing</a></div>
      <div><h3>Legal</h3><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><a href="mailto:support@xtalenti.com">support@xtalenti.com</a></div>
    </div><div className="flex flex-col gap-3 border-t border-white/10 py-5 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {APP_BRAND_NAME}. Të gjitha të drejtat e rezervuara.</span><span>MORE THAN FOOTBALL</span></div></div></footer>
  </div>;
}
