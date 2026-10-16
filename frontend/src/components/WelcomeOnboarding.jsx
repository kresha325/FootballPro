import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_BRAND_NAME, APP_BRAND_WORDMARK } from '../config/branding';
import { LANGUAGES } from '../locales/catalog';
import { LANGUAGE_KEY, useLocale } from '../contexts/LocaleContext';

export const WELCOME_ONBOARDING_KEY = 'fp_welcome_onboarding_v2';

export function isWelcomeOnboardingDone() {
  try {
    return localStorage.getItem(WELCOME_ONBOARDING_KEY) === '1' && Boolean(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return false;
  }
}

export function markWelcomeOnboardingDone() {
  try {
    localStorage.setItem(WELCOME_ONBOARDING_KEY, '1');
    localStorage.removeItem('fp_welcome_onboarding_done');
  } catch {
    /* ignore */
  }
}

const SLIDES = [
  {
    key: 'discover',
    image: '/onboarding/onboard-discover.png',
    title: 'Zbulo talentin',
    body: 'Krijo profilin tënd, postimet dhe highlights — klube e skautë të shohin kush je.',
  },
  {
    key: 'connect',
    image: '/onboarding/onboard-connect.png',
    title: 'Lidhu me futbollin',
    body: 'Mesazhe, skautim, turne dhe live — gjithçka në një vend për lojtarë, klube dhe trajnerë.',
  },
  {
    key: 'grow',
    image: '/onboarding/onboard-grow.png',
    title: `Rritu me ${APP_BRAND_NAME}`,
    body: 'Ndërto karrierën, merr ftesa dhe qëndro i dukshëm për ata që kërkojnë talent.',
  },
];

export default function WelcomeOnboarding() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLocale();
  const [languageSelected, setLanguageSelected] = useState(() => {
    try { return Boolean(localStorage.getItem(LANGUAGE_KEY)); } catch { return false; }
  });
  const [index, setIndex] = useState(0);

  const selectLanguage = (code) => {
    setLanguage(code);
    setLanguageSelected(true);
    try {
      if (localStorage.getItem(WELCOME_ONBOARDING_KEY) === '1') navigate('/', { replace: true });
    } catch { /* continue into onboarding if storage is unavailable */ }
  };

  useEffect(() => {
    if (isWelcomeOnboardingDone()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const finish = () => {
    markWelcomeOnboardingDone();
    navigate('/', { replace: true });
  };

  const goNext = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const slide = SLIDES[index];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--xt-color-canvas)] text-[var(--xt-color-text)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-[var(--xt-color-gold)]">X</span>
          <span>{APP_BRAND_WORDMARK}</span>
        </div>
        {languageSelected ? (
          <button type="button" onClick={finish} className="text-sm font-semibold text-[var(--xt-color-text-muted)] hover:text-[var(--xt-color-text)]">{t('skip')}</button>
        ) : null}
      </header>

      {!languageSelected ? (
        <main className="flex-1 flex flex-col justify-center px-6 py-8 max-w-lg mx-auto w-full">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3 text-[var(--xt-color-text)]">{t('chooseLanguage')}</h1>
          <p className="mb-7 text-[var(--xt-color-text-muted)]">{t('languagePrompt')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map((item) => (
              <button key={item.code} type="button" onClick={() => selectLanguage(item.code)} aria-pressed={language === item.code}
                className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left font-semibold transition ${language === item.code ? 'border-[var(--xt-color-gold)] bg-[var(--xt-color-gold)]/10 text-[var(--xt-color-text)]' : 'border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] text-[var(--xt-color-text)] hover:border-[var(--xt-color-gold)]'}`}>
                <span>{item.name}</span>{language === item.code ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </main>
      ) : (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-lg mx-auto w-full">
        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-md mb-8 bg-[var(--xt-color-surface-raised)] ring-1 ring-[var(--xt-color-border)]">
          <img
            key={slide.key}
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 text-[var(--xt-color-text)]">{t(`${slide.key}Title`)}</h1>
        <p className="text-base md:text-lg text-[var(--xt-color-text-muted)] leading-relaxed">{t(`${slide.key}Body`)}</p>

        <div className="flex gap-2 mt-10 mb-8">
          {SLIDES.map((s, i) => (
            <span
              key={s.key}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-[var(--xt-color-gold)]' : 'w-2 bg-[var(--xt-color-border-strong)]'
              }`}
            />
          ))}
        </div>
      </main>
      )}

      {languageSelected ? <footer className="px-5 pb-8 space-y-3 max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={goNext}
          className="w-full py-3.5 rounded-xl bg-[var(--xt-color-gold)] text-[#101114] font-bold text-lg hover:opacity-95 transition"
        >
          {index >= SLIDES.length - 1 ? t('start') : t('continue')}
        </button>
        {index >= SLIDES.length - 1 ? (
          <p className="text-center text-sm text-[var(--xt-color-text-muted)]">
            {t('haveAccount')}{' '}
            <Link to="/login" onClick={markWelcomeOnboardingDone} className="text-[var(--xt-color-gold-bright)] font-semibold">
              {t('login')}
            </Link>
          </p>
        ) : null}
      </footer> : null}
    </div>
  );
}
