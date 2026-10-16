import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, profileAPI, youtubeAPI } from '../services/api';
import api from '../services/api';
import { needsYoutubeResolve, normalizeYoutubeChannelId } from '../utils/youtubeChannel';
import { MoonIcon, SunIcon, UserIcon, BellIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import ParentVerificationForm from './ParentVerificationForm';
import { Link } from 'react-router-dom';
import ProPerksPanel from './ProPerksPanel';
import NotificationPreferences from './NotificationPreferences';
import { LANGUAGES } from '../locales/catalog';
import { useLocale } from '../contexts/LocaleContext';

const Settings = () => {
  const { user, refreshUser, logout, darkMode, toggleDarkMode } = useAuth();
  const { language, setLanguage, t } = useLocale();
  const selectLanguage = async (nextLanguage) => {
    setLanguage(nextLanguage);
    if (!user?.id) return;
    try { await authAPI.updateLanguage(nextLanguage); } catch { /* local preference remains available offline */ }
  };
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    youtubeChannelId: '',
  });
  const [profileTheme, setProfileTheme] = useState('default');
  const [verification, setVerification] = useState({
    needsParentVerification: false,
    parentVerified: false,
    clubVerified: false,
    verified: false,
    role: '',
  });
  const [showParentForm, setShowParentForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [resolvingYoutube, setResolvingYoutube] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const resolveSkipRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    setProfile({
      name: displayName || user.firstName || '',
      email: user.email || '',
      bio: user.bio || '',
      youtubeChannelId: user.youtubeChannelId || '',
    });
    profileAPI
      .getProfile(user.id)
      .then((res) => {
        const p = res.data || {};
        setProfileTheme(p.profileTheme || 'default');
        setVerification({
          needsParentVerification: Boolean(p.needsParentVerification),
          parentVerified: Boolean(p.parentVerified),
          clubVerified: Boolean(p.clubVerified),
          verified: Boolean(p.verified),
          role: p.role || user.role || '',
        });
      })
      .catch(() => {});
  }, [user]);

  const resolveYoutubeFromInput = async (raw, { silent } = { silent: false }) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      setResolveError('');
      return null;
    }
    const existing = normalizeYoutubeChannelId(trimmed);
    if (existing) {
      setResolveError('');
      if (trimmed !== existing) {
        resolveSkipRef.current = true;
        setProfile((p) => ({ ...p, youtubeChannelId: existing }));
      }
      return existing;
    }
    if (!needsYoutubeResolve(trimmed)) {
      setResolveError('Format i panjohur — përdor linkun nga YouTube Share.');
      return null;
    }

    setResolvingYoutube(true);
    setResolveError('');
    try {
      const res = await youtubeAPI.resolveChannel(trimmed);
      const id = res.data?.channelId || null;
      if (!id) {
        setResolveError('Nuk u gjet kanali. Kontrollo emrin @ ose lidhu me internet.');
        if (!silent) setSaveMessage({ type: 'error', text: t('Nuk u gjet Channel ID.') });
        return null;
      }
      resolveSkipRef.current = true;
      setProfile((p) => ({ ...p, youtubeChannelId: id }));
      setResolveError('');
      if (!silent) setSaveMessage({ type: 'ok', text: `U gjet ID: ${id}` });
      return id;
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Nuk u gjet Channel ID';
      setResolveError(msg);
      if (!silent) setSaveMessage({ type: 'error', text: msg });
      return null;
    } finally {
      setResolvingYoutube(false);
    }
  };

  useEffect(() => {
    const raw = String(profile.youtubeChannelId || '').trim();
    if (!raw || normalizeYoutubeChannelId(raw)) {
      setResolveError('');
      return undefined;
    }
    if (!needsYoutubeResolve(raw)) return undefined;
    if (resolveSkipRef.current) {
      resolveSkipRef.current = false;
      return undefined;
    }

    const timer = setTimeout(() => {
      resolveYoutubeFromInput(raw, { silent: true });
    }, 700);
    return () => clearTimeout(timer);
  }, [profile.youtubeChannelId]);

  const handleResolveYoutube = () => resolveYoutubeFromInput(profile.youtubeChannelId, { silent: false });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaveMessage({ type: '', text: '' });
    const trimmedName = profile.name.trim();
    if (!trimmedName) {
      setSaveMessage({ type: 'error', text: t('Shkruaj të paktën emrin.') });
      return;
    }
    const parts = trimmedName.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

    setSaving(true);
    try {
      let yt = String(profile.youtubeChannelId || '').trim();
      let ytNorm = normalizeYoutubeChannelId(yt);

      if (yt && !ytNorm && needsYoutubeResolve(yt)) {
        ytNorm = await resolveYoutubeFromInput(yt, { silent: true });
        if (ytNorm) yt = ytNorm;
      }

      if (yt && !ytNorm) {
        setSaveMessage({ type: 'error', text: t('YouTube ID i pavlefshëm ose nuk u zgjidh.') });
        return;
      }

      const form = new FormData();
      form.append('firstName', firstName);
      form.append('lastName', lastName);
      form.append('bio', profile.bio || '');
      form.append('youtubeChannelId', ytNorm || yt);
      await profileAPI.updateProfile(form);
      await refreshUser();
      setSaveMessage({ type: 'ok', text: t('Profili u përditësua.') });
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Përditësimi dështoi.';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-[var(--xt-color-surface)] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--xt-color-text)] shadow-md sm:p-6">
      <h1 className="mb-8 text-3xl font-bold text-[var(--xt-color-text)]">{t('settings')}</h1>

      <section className="mb-8 rounded-lg border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] p-4">
        <h2 className="mb-1 text-xl font-semibold">{t('language')}</h2>
        <p className="mb-3 text-sm text-[var(--xt-color-text-muted)]">{t('languagePrompt')}</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((item) => (
            <button key={item.code} type="button" onClick={() => selectLanguage(item.code)}
              aria-pressed={language === item.code}
              className={`rounded-full border px-3 py-1.5 text-sm ${language === item.code ? 'border-[var(--xt-color-gold)] bg-[var(--xt-color-gold)] text-black' : 'border-[var(--xt-color-border)]'}`}>
              {item.name}
            </button>
          ))}
        </div>
      </section>




      {/* Dark Mode Toggle */}
      <div className="mb-8">
        <h2 className="mb-4 flex items-center text-xl font-semibold text-[var(--xt-color-text)]">
          <MoonIcon className="mr-2 h-6 w-6" />
          {t('Appearance')}
        </h2>
        <div className="flex items-center justify-between rounded-lg bg-[var(--xt-color-surface-raised)] p-4 border border-[var(--xt-color-border)]">
          <span className="text-[var(--xt-color-text-muted)]">{t('Dark mode')}</span>
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              darkMode ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <BellIcon className="w-6 h-6 mr-2" />
          {t('notifications')}
        </h2>
        <div className="rounded-lg border border-[var(--xt-color-border)] p-4">
          <NotificationPreferences />
        </div>
      </div>

      {/* Verification (existing users) */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <ShieldCheckIcon className="w-6 h-6 mr-2" />
          {t('Verification')}
        </h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-800">
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                verification.clubVerified ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {verification.clubVerified ? '✓' : '○'} {t("Klubi")}
            </span>
            {(verification.needsParentVerification || verification.parentVerified) && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                  verification.parentVerified ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {verification.parentVerified ? '✓' : '○'} {t("Prindi")}
              </span>
            )}
            {verification.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold bg-green-100 text-green-800">
                {t("✓ I verifikuar plotësisht")}
              </span>
            ) : null}
          </div>

          {verification.needsParentVerification && !verification.parentVerified ? (
            <div>
              {!showParentForm ? (
                <button
                  type="button"
                  onClick={() => setShowParentForm(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold"
                >
                  {t("Dërgo verifikimin e prindit")}
                </button>
              ) : (
                <ParentVerificationForm
                  compact
                  onDone={(ok) => {
                    if (ok) {
                      setVerification((v) => ({ ...v }));
                    }
                  }}
                />
              )}
              <p className="mt-2 text-xs text-gray-500">
                {t("Ose hap faqen")}{' '}
                <Link to="/parent-verification" className="text-teal-700 underline">
                  /parent-verification
                </Link>
              </p>
            </div>
          ) : verification.parentVerified ? (
            <p className="text-sm text-green-700 dark:text-green-300">{t("Prindi është verifikuar.")}</p>
          ) : String(verification.role).toLowerCase() === 'athlete' ? (
            <p className="text-sm text-gray-500">{t("Verifikimi i prindit nuk kërkohet (18+).")}</p>
          ) : (
            <p className="text-sm text-gray-500">
              {t("Për trajner, referee dhe role të tjera: badge i verifikuar me planin Basic ose Pro (ose trial\n              30-ditor). Shiko")}{' '}
              <Link to="/premium" className="text-teal-700 underline">
                {t("planet")}
              </Link>
              .
            </p>
          )}

          {!verification.clubVerified && String(verification.role).toLowerCase() === 'athlete' ? (
            <p className="text-xs text-gray-500">
              {t("Badge Klubi aktivizohet kur klubi të pranon në skuadër.")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Profile Settings */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <UserIcon className="w-6 h-6 mr-2" />
          {t('profile')}
        </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          {saveMessage.text ? (
            <p
              className={`text-sm rounded-md px-3 py-2 ${
                saveMessage.type === 'ok'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              }`}
            >
              {saveMessage.text}
            </p>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Full name')}
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("Email")}
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Ndryshimi i email-it kërkon flow të veçantë në server.")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("Bio")}
            </label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("YouTube channel ID (live)")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={profile.youtubeChannelId}
                onChange={(e) => setProfile({ ...profile, youtubeChannelId: e.target.value })}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                placeholder={t('UC… ose link @handle / Share')}
              />
              <button
                type="button"
                onClick={handleResolveYoutube}
                disabled={resolvingYoutube || !profile.youtubeChannelId?.trim()}
                className="shrink-0 px-3 py-2 rounded-md bg-gray-800 dark:bg-gray-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {resolvingYoutube ? t('Duke kërkuar…') : t('Gjej UC…')}
              </button>
            </div>
            {resolveError ? (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{resolveError}</p>
            ) : needsYoutubeResolve(profile.youtubeChannelId) ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {t("Link @ — do të zgjidhet automatikisht ose shtyp «Gjej UC…».")}
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t("Lëre bosh për LiveKit. Nëse e plotëson, stream-et e reja lidhen me YouTube (OBS → YouTube).")}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? t('Duke ruajtur…') : t('Ruaj profilin')}
          </button>
        </form>
      </div>

      {/* Privacy & Security */}
      <div className="mb-8">
        <ProPerksPanel
          user={user}
          profileTheme={profileTheme}
          onThemeSaved={(id) => setProfileTheme(id)}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <ShieldCheckIcon className="w-6 h-6 mr-2" />
          {t("Ndihmë, info & ligjore")}
        </h2>
        <div className="space-y-2">
          <Link
            to="/help"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Ndihmë & FAQ")}
          </Link>
          <Link
            to="/about"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Rreth X TALENTI")}
          </Link>
          <Link
            to="/community-guidelines"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Udhëzuesit e komunitetit")}
          </Link>
          <Link
            to="/privacy"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Politika e privatësisë")}
          </Link>
          <Link
            to="/terms"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Kushtet e përdorimit")}
          </Link>
          <Link
            to="/cookies"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Politika e cookies")}
          </Link>
          <Link
            to="/data"
            className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {t("Të dhënat e tua (akses / fshirje)")}
          </Link>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
            <p className="text-sm text-red-700 dark:text-red-300 font-semibold">{t("Fshi llogarinë")}</p>
            <p className="text-xs text-red-600/80 dark:text-red-300/80">
              {t("Anonimizohen të dhënat personale. Ky veprim nuk kthehet.")}
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t('Fjalëkalimi yt')}
              className="w-full px-3 py-2 rounded border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800 text-sm"
            />
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!deletePassword) {
                  setSaveMessage({ type: 'error', text: t('Vendos fjalëkalimin për të fshirë llogarinë.') });
                  return;
                }
                if (!window.confirm(t('Je i sigurt që do ta fshish llogarinë?'))) return;
                setDeleting(true);
                try {
                  await api.delete('/moderation/account', {
                    data: { password: deletePassword, confirm: 'DELETE' },
                  });
                  logout();
                  window.location.href = '/';
                } catch (err) {
                  setSaveMessage({
                    type: 'error',
                    text: err?.response?.data?.msg || 'Nuk u fshi llogaria',
                  });
                } finally {
                  setDeleting(false);
                }
              }}
              className="w-full text-left p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? t('Duke fshirë…') : t('Fshi llogarinë time')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
