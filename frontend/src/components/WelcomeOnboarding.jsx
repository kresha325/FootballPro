import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_BRAND_NAME, APP_BRAND_WORDMARK } from '../config/branding';

export const WELCOME_ONBOARDING_KEY = 'fp_welcome_onboarding_v2';

export function isWelcomeOnboardingDone() {
  try {
    return localStorage.getItem(WELCOME_ONBOARDING_KEY) === '1';
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
  const [index, setIndex] = useState(0);

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
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-teal-50 via-slate-50 to-white text-slate-900">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-teal-700">X</span>
          <span>{APP_BRAND_WORDMARK}</span>
        </div>
        <button
          type="button"
          onClick={finish}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Anashkalo
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-lg mx-auto w-full">
        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-md mb-8 bg-teal-100 ring-1 ring-teal-900/5">
          <img
            key={slide.key}
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">{slide.title}</h1>
        <p className="text-base md:text-lg text-slate-600 leading-relaxed">{slide.body}</p>

        <div className="flex gap-2 mt-10 mb-8">
          {SLIDES.map((s, i) => (
            <span
              key={s.key}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-teal-700' : 'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>
      </main>

      <footer className="px-5 pb-8 space-y-3 max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={goNext}
          className="w-full py-3.5 rounded-xl bg-teal-700 text-white font-bold text-lg hover:bg-teal-800 transition"
        >
          {index >= SLIDES.length - 1 ? 'Fillo' : 'Vazhdo'}
        </button>
        {index >= SLIDES.length - 1 ? (
          <p className="text-center text-sm text-slate-500">
            Ke llogari?{' '}
            <Link to="/login" onClick={markWelcomeOnboardingDone} className="text-teal-700 font-semibold">
              Hyr
            </Link>
          </p>
        ) : null}
      </footer>
    </div>
  );
}
