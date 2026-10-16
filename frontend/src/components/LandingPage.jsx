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
import LandingPlayerShowcase from './LandingPlayerShowcase';
import { useLocale } from '../contexts/LocaleContext';
import './LandingPage.css';

/** Free 30 ditë · Basic €5.99/muaj · Pro €11.99/muaj · vjetore = 10 muaj (2 muaj falas). */
const ROLE_GROUPS = {
  individual: {
    label: 'Lojtarë, Trajnerë & Skautë', roles: 'Atlet · Trajner · Skaut · Menaxher · Gjyqtar',
    plans: {
      social: { name: 'Free', price: 0, period: '30 ditë' },
      basic: { name: 'Basic', price: 5.99, period: '/muaj', yearly: 59.9 },
      pro: { name: 'Pro', price: 11.99, period: '/muaj', yearly: 119.9 },
    },
  },
  organization: {
    label: 'Klube, Federata & Media', roles: 'Klub · Federatë · Ligë · Media · Biznes',
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
  { label: 'Badge i verifikuar (role jo-atlet)', social: false, basic: true, pro: true },
  { label: 'Analitika e avancuar e profilit', social: false, basic: true, pro: true },
  { label: 'Video highlights (Basic deri 10)', social: false, basic: true, pro: true },
  { label: 'Highlights pa limit', social: false, basic: false, pro: true },
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
  const { t } = useLocale();
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
          {navLinks.map(([label, href]) => <a key={label} href={href} className="xt-nav-link">{t(label)}</a>)}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link to="/login" className="xt-login-link">{t('login')}</Link>
          <Link to="/register" className="xt-button xt-button-gold !min-h-11 !px-5">{t('Regjistrohu Falas')}</Link>
        </div>
        <button type="button" aria-label={menuOpen ? t('Close menu') : t('Open menu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="xt-menu-button md:hidden">
          {menuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>
      {menuOpen && <nav className="xt-mobile-menu md:hidden" aria-label="Navigimi mobil">
        {navLinks.map(([label, href]) => <a key={label} href={href} onClick={closeMenu}>{t(label)}<ArrowRightIcon className="h-4 w-4" /></a>)}
        <Link to="/login" onClick={closeMenu}>{t('login')}</Link><Link to="/register" onClick={closeMenu} className="xt-button xt-button-gold">{t('Regjistrohu Falas')}</Link>
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
            <Reveal><span className="xt-hero-kicker"><span />{t('tagline')}</span></Reveal>
            <Motion.h1 initial="hidden" animate="show" variants={stagger} className="mt-7 font-black leading-[.96] tracking-[-.055em] text-white">
              {['Zbulo.', 'Zhvillo.', 'Shko Më Tej.'].map((line, i) => <Motion.span key={line} variants={fade} transition={{ duration: .65, delay: i * .12 }} className={`block text-[clamp(3.65rem,10vw,7.7rem)] ${i === 2 ? 'text-[var(--xt-gold-bright)]' : ''}`}>{t(line)}</Motion.span>)}
            </Motion.h1>
            <Reveal delay={0.25}><p className="mt-7 max-w-[560px] text-base leading-7 text-white/75 md:text-lg md:leading-8">{t('A digital platform connecting football talent, clubs, scouts and opportunities in one ecosystem.')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="xt-button xt-button-gold">{t('Regjistrohu Falas')} <ArrowRightIcon className="h-4 w-4" /></Link>
                <a href="#pricing" className="xt-button xt-button-outline">{t('View pricing')}</a>
              </div>
            </Reveal>
          </div>
          <Reveal className="hidden justify-end lg:flex" delay={0.35}>
            <div className="xt-hero-panel"><span className="xt-eyebrow">{t('One connected game')}</span><h2>{t('MORE THAN')}<br /><em>{t('FOOTBALL')}</em></h2><div className="xt-hero-rules" />
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">{['PLAYERS', 'CLUBS', 'SCOUTS', 'TOURNAMENTS', 'OPPORTUNITIES'].map((item, i) => <div key={item} className={`xt-capability ${i === 4 ? 'col-span-2' : ''}`}><span>0{i + 1}</span>{t(item)}</div>)}</div>
            </div>
          </Reveal>
        </div>
        <a href="#platform" aria-label={t('Continue to platform')} className="xt-scroll-cue"><span>{t('SCROLL TO DISCOVER')}</span><ArrowDownIcon className="h-4 w-4" /></a>
      </section>

      <section id="platform" className="xt-section xt-platform-section">
        <div className="xt-container">
          <div className="grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
            <Reveal><SectionHeading eyebrow={t('ONE PLATFORM · MANY POSSIBILITIES')} title={t('More than a football profile.')} description={t('X TALENTI creates a space where talent can grow, be presented and be discovered.')} /><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--xt-muted)]">{t('REAL PROFILES FROM THE PLATFORM')}</p></Reveal>
            <Reveal delay={.12}><div className="xt-dashboard-preview">
              <div className="xt-preview-top"><div className="flex items-center gap-2"><span className="xt-dot" /><span className="xt-dot" /><span className="xt-dot" /></div><span className="text-xs tracking-[.12em] text-white/50">X TALENTI / {t('PLAYER SPACE')}</span><span className="text-[10px] text-white/45">{t('LIVE')}</span></div>
              <div className="grid gap-4 p-4 sm:grid-cols-[.82fr_1.18fr] sm:p-6">
                <LandingPlayerShowcase />
                <div className="grid grid-cols-2 gap-3">
                  {[[ChartBarIcon, 'Performance', 'Statistics & progress'], [PlayIcon, 'Matches', 'Match history'], [MagnifyingGlassIcon, 'Scouting', 'Player discovery'], [MapPinIcon, 'Opportunities', 'Career connections']].map(([_Icon, title, desc]) => <div key={title} className="xt-preview-tile"><_Icon className="h-5 w-5 text-[var(--xt-gold)]" /><h4>{t(title)}</h4><p>{t(desc)}</p><div className="xt-skeleton-line" /></div>)}
                  <div className="xt-preview-activity col-span-2"><span className="xt-live-mark" /> {t('YOUR FOOTBALL JOURNEY, CONNECTED')} <ArrowRightIcon className="ml-auto h-4 w-4" /></div>
                </div>
              </div>
            </div></Reveal>
          </div>
        </div>
      </section>

      <section id="features" className="xt-section xt-feature-section"><div className="xt-container">
        <Reveal><SectionHeading eyebrow={t('BUILT AROUND THE GAME')} title={t('Everything a talent needs.')} description={t('The tools and connections behind every step, from the first profile to the next opportunity.')} align="center" /></Reveal>
        <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: .08 }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map(([_Icon, title, description], i) => <Motion.article variants={fade} transition={{ duration: .45 }} key={title} className="xt-feature-card"><span className="xt-feature-index">{String(i + 1).padStart(2, '0')}</span><_Icon className="h-6 w-6 text-[var(--xt-gold)]" /><h3>{t(title)}</h3><p>{t(description)}</p><ArrowRightIcon className="xt-card-arrow h-4 w-4" /></Motion.article>)}
        </Motion.div>
      </div></section>

      <section id="players" className="xt-player-section"><div className="xt-player-image" aria-hidden="true" /><div className="xt-container relative z-10 grid items-center gap-8 py-24 md:py-32 lg:grid-cols-2">
        <Reveal><p className="xt-eyebrow">{t('THE PLAYER JOURNEY')}</p><h2 className="xt-heading max-w-xl !text-white">{t('Turn talent')}<br /><span className="text-[var(--xt-gold-bright)]">{t('into opportunity.')}</span></h2><p className="mt-5 max-w-lg leading-7 text-white/65">{t('Present yourself your way and create a football story clubs and scouts can discover.')}</p><Link to="/register" className="xt-button xt-button-gold mt-8">{t('Create your profile')} <ArrowRightIcon className="h-4 w-4" /></Link></Reveal>
        <Reveal delay={.12}><div className="xt-player-capabilities">{['Your profile', 'Digital CV', 'Statistics', 'Video highlights', 'Matches', 'Scout visibility', 'Club opportunities', 'Messages'].map((label, i) => <div key={label}><span>0{i + 1}</span>{t(label)}<CheckIcon className="ml-auto h-4 w-4 text-[var(--xt-gold)]" /></div>)}</div></Reveal>
      </div></section>

      <section id="clubs" className="xt-section"><div className="xt-container">
        <Reveal><SectionHeading eyebrow={t('A SHARED NETWORK')} title={t('Connect the people moving the game forward.')} description={t('Talent is easier to discover and develop when clubs, scouts and players meet in one ecosystem.')} /></Reveal>
        <div className="grid gap-4 md:grid-cols-2"><Reveal><article className="xt-audience-card xt-club-card"><span className="xt-audience-index">01 / {t('FOR CLUBS')}</span><h3>{t('Find and')}<br />{t('manage talent.')}</h3><p>{t('Player discovery · Profile · Statistics · Shortlisting')}</p><Link to="/register" aria-label={t('Register as a club')} className="xt-round-arrow"><ArrowRightIcon className="h-5 w-5" /></Link></article></Reveal>
          <Reveal delay={.12}><article className="xt-audience-card xt-scout-card"><span className="xt-audience-index">02 / {t('FOR SCOUTS')}</span><h3>{t('Discover the')}<br />{t('next generation.')}</h3><p>{t('Search · Filters · Communication · Opportunities')}</p><Link to="/register" aria-label={t('Register as a scout')} className="xt-round-arrow"><ArrowRightIcon className="h-5 w-5" /></Link></article></Reveal></div>
      </div></section>

      <section id="tournaments" className="xt-match-section"><div className="xt-container py-24 md:py-32"><Reveal><SectionHeading eyebrow={t('THE GAME IN MOTION')} title={t('Every match tells a story.')} description={t('Tournaments, matches and performances add context to every player’s journey.')} /></Reveal>
        <div className="grid gap-3 md:grid-cols-3"><Reveal><article className="xt-match-card xt-match-primary"><TrophyIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>{t('COMPETITION')}</span><h3>{t('TOURNAMENTS')}</h3><p>{t('Tournaments and participation')}</p></article></Reveal><Reveal delay={.08}><article className="xt-match-card"><PlayIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>{t('ON THE PITCH')}</span><h3>{t('MATCHES')}</h3><p>{t('Matches and history')}</p></article></Reveal><Reveal delay={.16}><article className="xt-match-card"><ChartBarIcon className="h-7 w-7 text-[var(--xt-gold)]" /><span>{t('PLAYER JOURNEY')}</span><h3>{t('PERFORMANCE')}</h3><p>{t('Statistics and progress')}</p></article></Reveal></div>
      </div></section>

      <section className="xt-ecosystem-section"><div className="xt-container py-20 md:py-24"><Reveal><SectionHeading eyebrow={t('MORE THAN FOOTBALL')} title={t('An ecosystem for the whole game.')} description={t('Connections between the roles and organizations that shape football.')} align="center" /></Reveal><Reveal><div className="xt-ecosystem">{['PLAYERS', 'CLUBS', 'SCOUTS', 'COACHES', 'AGENTS', 'FEDERATIONS', 'TOURNAMENTS'].map((label, i) => <span key={label}><i>0{i + 1}</i>{t(label)}</span>)}</div></Reveal></div></section>

      <section id="pricing" className="xt-section xt-pricing-section"><div className="xt-container"><Reveal><SectionHeading eyebrow={t('CLEAR PLANS · REAL POSSIBILITIES')} title={t('Find your game plan.')} description={t('Choose a plan for your football role.')} align="center" /></Reveal>
        <div className="mb-5 flex justify-center"><div className="xt-plan-toggle" role="group" aria-label={t('Choose account type')}>{Object.entries(ROLE_GROUPS).map(([key, value]) => <button type="button" key={key} onClick={() => setRoleGroup(key)} aria-pressed={roleGroup === key} className={roleGroup === key ? 'active' : ''}>{t(value.label)}</button>)}</div></div><p className="mb-9 text-center text-xs tracking-[.1em] text-[var(--xt-muted)]">{t(group.roles)}</p>
        <div className="grid gap-3 lg:grid-cols-3">{['social', 'basic', 'pro'].map((planKey, index) => { const plan = group.plans[planKey]; const featured = planKey === 'pro'; return <Reveal key={planKey} delay={index * .06}><article className={`xt-plan-card ${featured ? 'featured' : ''}`}>
          {featured && <span className="xt-plan-ribbon">PRO</span>}<span className="xt-plan-label">{t(plan.name)}</span><div className="xt-plan-price">{plan.price === 0 ? <>{t('Falas')}<small> {t(plan.period)}</small></> : <>€{plan.price}<small> {t(plan.period)}</small></>}</div>
          {plan.yearly ? <p className="xt-plan-yearly">{t('or')} €{plan.yearly}{t('per year')} · {t('2 months free')}</p> : null}
          <ul>{FEATURE_MATRIX.filter(feature => feature[planKey]).map(feature => <li key={feature.label}><CheckIcon className="h-4 w-4 shrink-0 text-[var(--xt-gold)]" />{t(feature.label)}</li>)}</ul><Link to="/register" className={`xt-button ${featured ? 'xt-button-gold' : 'xt-button-outline'} w-full`}>{plan.price === 0 ? t('Start free') : t('registerTab')}<ArrowRightIcon className="h-4 w-4" /></Link>
        </article></Reveal>; })}</div>
        <div className="mt-8 hidden overflow-hidden rounded-xl border border-white/10 md:block"><table className="xt-price-table"><thead><tr><th>{t('Feature')}</th><th>{t('Free')}</th><th>{t('Basic')}</th><th>{t('Pro')}</th></tr></thead><tbody>{FEATURE_MATRIX.map(feature => <tr key={feature.label}><td>{t(feature.label)}</td>{['social', 'basic', 'pro'].map(key => <td key={key}>{feature[key] ? <CheckIcon className="mx-auto h-4 w-4 text-[var(--xt-gold)]" /> : <span aria-label={t('Not included')}>—</span>}</td>)}</tr>)}</tbody></table></div>
      </div></section>

      <section id="contact" className="xt-final-cta"><div className="xt-container py-20 text-center md:py-28"><Reveal><p className="xt-eyebrow justify-center">{t('tagline')}</p><h2>{t('Zbulo.')} {t('Zhvillo.')}<br /><span>{t('Shko Më Tej.')}</span></h2><p className="mx-auto mt-5 max-w-xl text-white/65">{t('Your football deserves new opportunities. Start your journey on X TALENTI.')}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="xt-button xt-button-gold">{t('Regjistrohu Falas')} <ArrowRightIcon className="h-4 w-4" /></Link><a href="#platform" className="xt-button xt-button-outline">{t('View the platform')}</a></div></Reveal></div></section>
    </main>

    <footer className="xt-footer"><div className="xt-container"><div className="grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:py-16">
      <div><a href="#top" className="flex items-center gap-2"><img src={APP_LOGO_SRC} alt="" width="38" height="38" className="h-9 w-9 object-contain" /><span className="text-lg font-black tracking-[.18em] text-white">{APP_BRAND_WORDMARK}</span></a><p className="mt-4 max-w-xs text-sm leading-6 text-white/50">{t('tagline')}<br />{t('Zbulo.')} {t('Zhvillo.')} {t('Shko Më Tej.')}</p></div>
      <div><h3>{t('Platform')}</h3><a href="#players">{t('Players')}</a><a href="#clubs">{t('Clubs')}</a><a href="#clubs">{t('Scouts')}</a><a href="#tournaments">{t('Tournaments')}</a><a href="#features">{t('Opportunities')}</a></div>
      <div><h3>{t('Company')}</h3><Link to="/about">{t('About')}</Link><Link to="/help">{t('Help')}</Link><a href="mailto:support@xtalenti.com">{t('Contact')}</a><a href="#pricing">{t('Pricing')}</a></div>
      <div><h3>{t('Legal')}</h3><Link to="/privacy">{t('Privacy')}</Link><Link to="/terms">{t('Terms')}</Link><Link to="/cookies">{t('Cookies')}</Link><Link to="/data">{t('Data')}</Link><Link to="/community-guidelines">{t('Community')}</Link></div>
    </div><div className="flex flex-col gap-3 border-t border-white/10 py-5 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {APP_BRAND_NAME}. {t('All rights reserved.')}</span><span>{t('MORE THAN FOOTBALL')}</span></div></div></footer>
  </div>;
}
