import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { APP_BRAND_WORDMARK } from '../config/branding';
import { setOnboardingPending } from './RegisterOnboarding';
import { safeNextPath } from '../utils/safeNextPath';

const POST_AUTH_NEXT_KEY = 'xtalenti_post_auth_next';

export const REGISTER_ROLE_OPTIONS = [
  { label: 'Lojtar', value: 'athlete', hint: 'Statistika, video, turne' },
  { label: 'Trajner', value: 'coach', hint: 'Skuadër, plane, ndeshje' },
  { label: 'Skaut', value: 'scout', hint: 'Talente, watchlist' },
  { label: 'Menaxher', value: 'manager', hint: 'Karrierë, kontrata' },
  { label: 'Arbitër', value: 'referee', hint: 'Ndeshje, kampionate' },
  { label: 'Klub', value: 'club', hint: 'Roster, turne, staf' },
  { label: 'Federatë', value: 'federation', hint: 'Organizim zyrtar' },
  { label: 'Media', value: 'media', hint: 'Reportazh, live' },
  { label: 'Biznes', value: 'business', hint: 'Sponsor, shërbime' },
];

function registerRoleLabel(value) {
  const v = String(value || '').toLowerCase();
  return REGISTER_ROLE_OPTIONS.find((o) => o.value === v)?.label || value || 'Lojtar';
}

function modeFromPath(pathname) {
  if (pathname.includes('register')) return 'register';
  if (pathname.includes('forgot')) return 'forgot';
  return 'login';
}

function buildIsoDate(y, m, d) {
  if (!y || !m || !d) return '';
  const yy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  if (yy.length !== 4 || mm.length !== 2 || dd.length !== 2) return '';
  return `${yy}-${mm}-${dd}`;
}

/**
 * Auth UI matching mobile LoginScreen: teal segments Hyr / Regjistrohu / Harruar?
 */
export default function AuthScreen({ initialMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();

  const nextPath = safeNextPath(searchParams.get('next'));
  const resolvedInitial = initialMode || modeFromPath(location.pathname);

  const [mode, setMode] = useState(resolvedInitial);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('athlete');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromPath = modeFromPath(location.pathname);
    setMode(initialMode || fromPath);
    setInlineError('');
    setSuccessMsg('');
  }, [location.pathname, initialMode]);

  useEffect(() => {
    if (searchParams.get('next')) {
      try {
        sessionStorage.setItem(POST_AUTH_NEXT_KEY, nextPath);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, nextPath]);

  const subtitle = useMemo(() => {
    if (mode === 'login') return 'Hyr për të vazhduar';
    if (mode === 'register') return 'Krijo llogarinë — karriera jote fillon këtu';
    return 'Rikupero fjalëkalimin';
  }, [mode]);

  const switchMode = (next) => {
    setMode(next);
    setInlineError('');
    setSuccessMsg('');
    const q = nextPath && nextPath !== '/feed' ? `?next=${encodeURIComponent(nextPath)}` : '';
    if (next === 'login') navigate(`/login${q}`, { replace: true });
    else if (next === 'register') navigate(`/register${q}`, { replace: true });
    else navigate('/forgot-password', { replace: true });
  };

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const onSubmit = async (e) => {
    e.preventDefault();
    setInlineError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setInlineError('Vendos email-in.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setInlineError('Email jo valid.');
      return;
    }
    if (mode !== 'forgot' && !password) {
      setInlineError('Vendos fjalëkalimin.');
      return;
    }
    if (mode !== 'forgot' && password.length < 6) {
      setInlineError('Fjalëkalimi: të paktën 6 karaktere.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setInlineError('Fjalëkalimet nuk përputhen.');
      return;
    }
    if (mode === 'register' && (!firstName.trim() || !lastName.trim())) {
      setInlineError('Vendos emrin dhe mbiemrin.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login({
          email: email.trim().toLowerCase(),
          password,
        });
        if (result.success) {
          navigate(nextPath);
        } else {
          setInlineError(result.error || 'Hyrja dështoi');
        }
        return;
      }

      if (mode === 'register') {
        const dateOfBirth = buildIsoDate(dobYear, dobMonth, dobDay);
        if (!dateOfBirth) {
          setInlineError('Vendos datëlindjen (ditë, muaj, vit).');
          return;
        }
        if (!acceptedTerms) {
          setInlineError('Duhet të pranosh kushtet e përdorimit.');
          return;
        }
        const result = await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: (role || 'athlete').trim().toLowerCase(),
          dateOfBirth,
        });
        if (result.success) {
          setOnboardingPending();
          navigate('/onboarding');
        } else {
          setInlineError(result.error || 'Regjistrimi dështoi');
        }
        return;
      }

      const response = await authAPI.forgotPassword(email.trim().toLowerCase());
      setSuccessMsg(response.data?.msg || 'Kontrollo email-in për linkun e rivendosjes.');
      if (response.data?.resetUrl) {
        const match = String(response.data.resetUrl).match(/reset-password\/([^/?#]+)/i);
        if (match?.[1]) {
          navigate(`/reset-password/${match[1]}`);
        }
      }
    } catch (err) {
      setInlineError(err.response?.data?.msg || err.message || 'Diçka shkoi keq');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[10px] border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700';

  return (
    <div className="min-h-[100dvh] bg-[#f0fdfa] text-slate-900">
      <div className="mx-auto max-w-md px-6 pt-12 pb-10">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1 text-[15px] font-semibold text-slate-900 hover:text-teal-800"
        >
          <span aria-hidden>‹</span> Kthehu
        </Link>

        <h1 className="text-[30px] font-extrabold uppercase tracking-tight">
          <span className="text-amber-500">X</span>
          {APP_BRAND_WORDMARK}
        </h1>
        <p className="mt-1.5 mb-4 text-slate-600 leading-snug">{subtitle}</p>

        {inlineError ? (
          <p className="mb-3 font-semibold text-red-700" role="alert">
            {inlineError}
          </p>
        ) : null}
        {successMsg ? (
          <p className="mb-3 font-semibold text-emerald-700" role="status">
            {successMsg}
          </p>
        ) : null}

        <div className="mb-3.5 flex rounded-[10px] bg-slate-200 p-1">
          {[
            { id: 'login', label: 'Hyr' },
            { id: 'register', label: 'Regjistrohu' },
            { id: 'forgot', label: 'Harruar?' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchMode(tab.id)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
                mode === tab.id ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'register' ? (
            <>
              <input
                className={inputClass}
                placeholder="Emri"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <input
                className={inputClass}
                placeholder="Mbiemri"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />

              <label className="block text-[13px] font-semibold text-slate-500">Lloji i llogarisë</label>
              <button
                type="button"
                onClick={() => setRolePickerOpen(true)}
                className={`${inputClass} flex items-center justify-between text-left font-semibold`}
              >
                <span>{registerRoleLabel(role)}</span>
                <span className="text-slate-500">▾</span>
              </button>

              <label className="block text-[13px] font-semibold text-slate-500">Datëlindja</label>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="DD"
                  inputMode="numeric"
                  maxLength={2}
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  autoComplete="bday-day"
                />
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="MM"
                  inputMode="numeric"
                  maxLength={2}
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  autoComplete="bday-month"
                />
                <input
                  className={`${inputClass} flex-[1.4]`}
                  placeholder="VVVV"
                  inputMode="numeric"
                  maxLength={4}
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  autoComplete="bday-year"
                />
              </div>
              <p className="text-xs text-slate-500 leading-snug">
                Nën 18 vjeç: do të kërkohet email i prindit pas regjistrimit.
              </p>
            </>
          ) : null}

          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {mode !== 'forgot' ? (
            <>
              <input
                className={inputClass}
                type="password"
                placeholder="Fjalëkalimi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              {mode === 'register' ? (
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Përsërit fjalëkalimin"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              ) : null}
            </>
          ) : null}

          {mode === 'register' ? (
            <label className="flex items-center gap-3 text-[13px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>Pranoj kushtet e përdorimit dhe privatësinë</span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-[10px] bg-teal-700 py-3.5 text-base font-bold text-white hover:bg-teal-800 disabled:opacity-50 transition"
          >
            {loading
              ? 'Duke u ngarkuar…'
              : mode === 'login'
                ? 'Hyr'
                : mode === 'register'
                  ? 'Krijo llogarinë'
                  : 'Dërgo linkun'}
          </button>
        </form>
      </div>

      {rolePickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 sm:items-center"
          onClick={() => setRolePickerOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md max-h-[70vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white pb-6 pt-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Lloji i llogarisë"
          >
            <h2 className="px-5 mb-2 text-lg font-extrabold text-slate-900">Lloji i llogarisë</h2>
            <ul>
              {REGISTER_ROLE_OPTIONS.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setRole(item.value);
                      setRolePickerOpen(false);
                    }}
                    className={`flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left hover:bg-teal-50 ${
                      role === item.value ? 'bg-teal-50' : ''
                    }`}
                  >
                    <span>
                      <span className="block font-bold text-slate-900">{item.label}</span>
                      {item.hint ? (
                        <span className="block text-xs text-slate-500 mt-0.5">{item.hint}</span>
                      ) : null}
                    </span>
                    {role === item.value ? <span className="text-teal-700 font-bold">✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
