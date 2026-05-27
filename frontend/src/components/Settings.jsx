import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI, youtubeAPI } from '../services/api';
import { needsYoutubeResolve, normalizeYoutubeChannelId } from '../utils/youtubeChannel';
import { MoonIcon, SunIcon, UserIcon, BellIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const NOTIFICATIONS_PREF_KEY = 'fp_notifications_enabled';

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    youtubeChannelId: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [resolvingYoutube, setResolvingYoutube] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const resolveSkipRef = useRef(false);

  useEffect(() => {
    setDarkMode(localStorage.getItem('theme') === 'dark');
    setNotifications(localStorage.getItem(NOTIFICATIONS_PREF_KEY) === 'true');
  }, []);

  useEffect(() => {
    if (!user) return;
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    setProfile({
      name: displayName || user.firstName || '',
      email: user.email || '',
      bio: user.bio || '',
      youtubeChannelId: user.youtubeChannelId || '',
    });
  }, [user]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleNotifications = () => {
    const next = !notifications;
    setNotifications(next);
    localStorage.setItem(NOTIFICATIONS_PREF_KEY, next ? 'true' : 'false');
  };

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
        if (!silent) setSaveMessage({ type: 'error', text: 'Nuk u gjet Channel ID.' });
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
      setSaveMessage({ type: 'error', text: 'Shkruaj të paktën emrin.' });
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
        setSaveMessage({ type: 'error', text: 'YouTube ID i pavlefshëm ose nuk u zgjidh.' });
        return;
      }

      const form = new FormData();
      form.append('firstName', firstName);
      form.append('lastName', lastName);
      form.append('bio', profile.bio || '');
      form.append('youtubeChannelId', ytNorm || yt);
      await profileAPI.updateProfile(form);
      await refreshUser();
      setSaveMessage({ type: 'ok', text: 'Profili u përditësua.' });
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Përditësimi dështoi.';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Cilësimet</h1>




      {/* Dark Mode Toggle */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <MoonIcon className="w-6 h-6 mr-2" />
          Appearance
        </h2>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300">Modaliteti i errët</span>
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
          Njoftimet
        </h2>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300">Aktivizo njoftimet</span>
          <button
            type="button"
            onClick={toggleNotifications}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <UserIcon className="w-6 h-6 mr-2" />
          Profili
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
              Emri (emër dhe mbiemër)
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
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ndryshimi i email-it kërkon flow të veçantë në server.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bio
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
              YouTube channel ID (live)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={profile.youtubeChannelId}
                onChange={(e) => setProfile({ ...profile, youtubeChannelId: e.target.value })}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                placeholder="UC… ose link @handle / Share"
              />
              <button
                type="button"
                onClick={handleResolveYoutube}
                disabled={resolvingYoutube || !profile.youtubeChannelId?.trim()}
                className="shrink-0 px-3 py-2 rounded-md bg-gray-800 dark:bg-gray-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {resolvingYoutube ? 'Duke kërkuar…' : 'Gjej UC…'}
              </button>
            </div>
            {resolveError ? (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{resolveError}</p>
            ) : needsYoutubeResolve(profile.youtubeChannelId) ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Link @ — do të zgjidhet automatikisht ose shtyp «Gjej UC…».
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lëre bosh për LiveKit. Nëse e plotëson, stream-et e reja lidhen me YouTube (OBS → YouTube).
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Duke ruajtur…' : 'Ruaj profilin'}
          </button>
        </form>
      </div>

      {/* Privacy & Security */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
          <ShieldCheckIcon className="w-6 h-6 mr-2" />
          Privatësia dhe siguria
        </h2>
        <div className="space-y-2">
          <button className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            Ndrysho fjalëkalimin
          </button>
          <button className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            Cilësimet e privatësisë
          </button>
          <button className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-red-600">
            Fshi llogarinë
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;