import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { APP_BRAND_WORDMARK } from '../config/branding';
import { setOnboardingPending } from './RegisterOnboarding';
import { safeNextPath } from '../utils/safeNextPath';
import { isOrgProfileRole } from '../utils/orgProfile';
import { BACKEND_URL } from '../config/api';

const POST_AUTH_NEXT_KEY = 'xtalenti_post_auth_next';

function OAuthButtons({ disabled }) {
  const [providers, setProviders] = useState({ google: false, facebook: false, apple: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authAPI
      .oauthProviders()
      .then((res) => {
        if (!cancelled) {
          setProviders({
            google: !!res?.data?.google,
            facebook: !!res?.data?.facebook,
            apple: !!res?.data?.apple,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setProviders({ google: false, facebook: false, apple: false });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || (!providers.google && !providers.facebook && !providers.apple)) return null;

  const start = (provider) => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
    window.location.href = `${base}/api/auth/${provider}`;
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-[var(--xt-color-text-muted)]">
        <span className="h-px flex-1 bg-[var(--xt-color-border)]" />
        ose
        <span className="h-px flex-1 bg-[var(--xt-color-border)]" />
      </div>
      {providers.apple ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => start('apple')}
          className="btn btn-outline flex w-full min-h-11 items-center justify-center gap-2 font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.42 2.23-1.17 3.06-.8.9-2.12 1.6-3.3 1.5-.14-1.1.4-2.26 1.14-3.06.8-.9 2.2-1.58 3.33-1.5zM20.9 17.3c-.55 1.26-.82 1.82-1.53 2.94-.99 1.55-2.39 3.48-4.13 3.5-1.54.02-1.94-.99-4.03-.98-2.1.01-2.54 1-4.08.98-1.74-.02-3.07-1.76-4.06-3.3C1.4 17.08.3 13.3 1.96 10.6c1.05-1.7 2.72-2.77 4.3-2.77 1.6 0 2.6.99 3.92.99 1.28 0 2.06-.99 3.93-.99 1.4 0 2.88.76 3.93 2.08-3.46 1.9-2.9 6.84.86 7.4z" />
          </svg>
          Vazhdo me Apple
        </button>
      ) : null}
      {providers.google ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => start('google')}
          className="btn btn-outline flex w-full min-h-11 items-center justify-center gap-2 font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.5 26.8 36.5 24 36.5c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.3 5.2C39.2 36.9 44 32 44 24c0-1.3-.1-2.5-.4-3.5z" />
          </svg>
          Vazhdo me Google
        </button>
      ) : null}
      {providers.facebook ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => start('facebook')}
          className="btn btn-outline flex w-full min-h-11 items-center justify-center gap-2 font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
            <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.54-4.7 1.32 0 2.7.24 2.7.24v2.98h-1.52c-1.5 0-1.97.93-1.97 1.89v2.26h3.35l-.54 3.49h-2.81V24C19.61 23.09 24 18.1 24 12.07z" />
          </svg>
          Vazhdo me Facebook
        </button>
      ) : null}
    </div>
  );
}

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
    setSuccessMsg('');
    const oauthErr = searchParams.get('error');
    if (oauthErr === 'oauth_failed') {
      setInlineError('Hyrja me Google/Apple/Facebook dështoi. Provo përsëri ose përdor email.');
    } else {
      setInlineError('');
    }
  }, [location.pathname, initialMode, searchParams]);

  useEffect(() => {
    if (searchParams.get('next')) {
      try {
        sessionStorage.setItem(POST_AUTH_NEXT_KEY, nextPath);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, nextPath]);

  useEffect(() => {
    if (!rolePickerOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setRolePickerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [rolePickerOpen]);

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
    if (mode === 'register' && !firstName.trim()) {
      setInlineError(isOrgProfileRole(role) ? 'Vendos emrin e organizatës.' : 'Vendos emrin dhe mbiemrin.');
      return;
    }
    if (mode === 'register' && !isOrgProfileRole(role) && !lastName.trim()) {
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
        const normalizedRole = (role || 'athlete').trim().toLowerCase();
        const isAthlete = normalizedRole === 'athlete';
        const isOrg = isOrgProfileRole(normalizedRole);
        let dateOfBirth;
        if (isAthlete) {
          dateOfBirth = buildIsoDate(dobYear, dobMonth, dobDay);
          if (!dateOfBirth) {
            setInlineError('Vendos datëlindjen (ditë, muaj, vit).');
            return;
          }
        }
        if (!acceptedTerms) {
          setInlineError('Duhet të pranosh kushtet e përdorimit.');
          return;
        }
        const result = await register({
          firstName: firstName.trim(),
          lastName: isOrg ? '' : lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: normalizedRole,
          ...(dateOfBirth ? { dateOfBirth } : {}),
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

  const inputClass = 'input !bg-[var(--xt-color-surface-raised)] !text-[var(--xt-color-text)] placeholder:!text-[var(--xt-color-text-subtle)]';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--xt-color-canvas)] px-4 py-8 text-[var(--xt-color-text)]">
      <div className="xt-card w-full max-w-md p-5 sm:p-8">
        <Link
          to="/"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--xt-color-text-muted)] transition-colors hover:text-[var(--xt-color-gold-bright)]"
        >
          <span aria-hidden>←</span> Kthehu
        </Link>

        <h1 className="text-3xl font-extrabold uppercase tracking-tight">
          <span className="text-[var(--xt-color-gold-bright)]">X</span>
          {APP_BRAND_WORDMARK}
        </h1>
        <p className="mb-5 mt-2 leading-snug text-[var(--xt-color-text-muted)]">{subtitle}</p>

        {inlineError ? (
          <p className="mb-3 rounded-lg border border-[var(--xt-color-danger)]/30 bg-[var(--xt-color-danger)]/10 p-3 font-semibold text-[var(--xt-color-danger)]" role="alert">
            {inlineError}
          </p>
        ) : null}
        {successMsg ? (
          <p className="mb-3 rounded-lg border border-[var(--xt-color-success)]/30 bg-[var(--xt-color-success)]/10 p-3 font-semibold text-[var(--xt-color-success)]" role="status">
            {successMsg}
          </p>
        ) : null}

        <div className="mb-5 flex rounded-lg border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] p-1" role="tablist" aria-label="Hyr ose krijo llogari">
          {[
            { id: 'login', label: 'Hyr' },
            { id: 'register', label: 'Regjistrohu' },
            { id: 'forgot', label: 'Harruar?' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchMode(tab.id)}
              role="tab"
              aria-selected={mode === tab.id}
              className={`min-h-11 flex-1 rounded-md px-1 text-xs font-semibold transition-colors sm:text-sm ${
                mode === tab.id ? 'bg-[var(--xt-color-gold)] text-[#101114]' : 'text-[var(--xt-color-text-muted)] hover:bg-white/5 hover:text-[var(--xt-color-text)]'
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
                aria-label={isOrgProfileRole(role) ? 'Emri i organizatës' : 'Emri'}
                placeholder={isOrgProfileRole(role) ? 'Emri i organizatës' : 'Emri'}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete={isOrgProfileRole(role) ? 'organization' : 'given-name'}
              />
              {!isOrgProfileRole(role) ? (
                <input
                  className={inputClass}
                  aria-label="Mbiemri"
                  placeholder="Mbiemri"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              ) : null}

              <label className="label">Lloji i llogarisë</label>
              <button
                type="button"
                onClick={() => setRolePickerOpen(true)}
                className={`${inputClass} flex min-h-11 items-center justify-between text-left font-semibold`}
                aria-haspopup="dialog"
                aria-expanded={rolePickerOpen}
              >
                <span>{registerRoleLabel(role)}</span>
                <span className="text-[var(--xt-color-text-muted)]" aria-hidden="true">▾</span>
              </button>

              {String(role || '').toLowerCase() === 'athlete' ? (
                <>
                  <label className="label">Datëlindja</label>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="DD"
                      aria-label="Dita e lindjes"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobDay}
                      onChange={(e) => setDobDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      autoComplete="bday-day"
                    />
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="MM"
                      aria-label="Muaji i lindjes"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobMonth}
                      onChange={(e) => setDobMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      autoComplete="bday-month"
                    />
                    <input
                      className={`${inputClass} flex-[1.4]`}
                      placeholder="VVVV"
                      aria-label="Viti i lindjes"
                      inputMode="numeric"
                      maxLength={4}
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      autoComplete="bday-year"
                    />
                  </div>
                  <p className="text-xs leading-snug text-[var(--xt-color-text-muted)]">
                    Nën 18 vjeç: do të kërkohet email i prindit pas regjistrimit.
                  </p>
                </>
              ) : null}
            </>
          ) : null}

          <input
            className={inputClass}
            aria-label="Email"
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
                aria-label="Fjalëkalimi"
                type="password"
                placeholder="Fjalëkalimi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              {mode === 'register' ? (
                <input
                  className={inputClass}
                  aria-label="Përsërit fjalëkalimin"
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
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] text-[var(--xt-color-text-muted)]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-5 w-5 rounded border-[var(--xt-color-border-strong)] accent-[var(--xt-color-gold)] focus-visible:outline"
              />
              <span>
                Pranoj{' '}
                <Link to="/terms" className="font-semibold text-[var(--xt-color-gold-bright)] underline underline-offset-2">
                  kushtet e përdorimit
                </Link>{' '}
                dhe{' '}
                <Link to="/privacy" className="font-semibold text-[var(--xt-color-gold-bright)] underline underline-offset-2">
                  privatësinë
                </Link>
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-2 w-full"
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

        {mode !== 'forgot' ? <OAuthButtons disabled={loading} /> : null}
      </div>

      {rolePickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setRolePickerOpen(false)}
          role="presentation"
        >
          <div
            className="xt-card max-h-[min(70vh,40rem)] w-full max-w-md overflow-auto rounded-t-2xl border-[var(--xt-color-border-strong)] bg-[var(--xt-color-surface)] pb-6 pt-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Lloji i llogarisë"
          >
            <h2 className="mb-2 px-5 text-lg font-extrabold text-[var(--xt-color-text)]">Lloji i llogarisë</h2>
            <ul>
              {REGISTER_ROLE_OPTIONS.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setRole(item.value);
                      if (isOrgProfileRole(item.value)) setLastName('');
                      setRolePickerOpen(false);
                    }}
                    className={`flex min-h-14 w-full items-center justify-between border-b border-[var(--xt-color-border)] px-5 py-3 text-left transition-colors hover:bg-white/5 ${
                      role === item.value ? 'bg-[var(--xt-color-gold)]/10' : ''
                    }`}
                  >
                    <span>
                      <span className="block font-bold text-[var(--xt-color-text)]">{item.label}</span>
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs text-[var(--xt-color-text-muted)]">{item.hint}</span>
                      ) : null}
                    </span>
                    {role === item.value ? <span className="font-bold text-[var(--xt-color-gold-bright)]" aria-label="Zgjedhur">✓</span> : null}
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
