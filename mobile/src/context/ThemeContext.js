import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorsFor } from '../theme/tokens';

const STORAGE_KEY = 'mobile_theme_preference_v1';

/** @typedef {'system' | 'light' | 'dark'} ThemePreference */

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState(/** @type {ThemePreference} */ ('system'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (raw === 'system' || raw === 'light' || raw === 'dark')) {
          setPreferenceState(raw);
        }
      } catch (_e) {
        // keep default
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(async (next) => {
    const value = next === 'light' || next === 'dark' || next === 'system' ? next : 'system';
    setPreferenceState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch (_e) {
      // ignore persist errors
    }
  }, []);

  const setDarkMode = useCallback(
    (enabled) => {
      setPreference(enabled ? 'dark' : 'light');
    },
    [setPreference]
  );

  const resolvedScheme = preference === 'system' ? systemScheme || 'light' : preference;
  const isDark = resolvedScheme === 'dark';
  const colors = useMemo(() => colorsFor(isDark), [isDark]);

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    if (Platform.OS === 'android' && typeof StatusBar.setBackgroundColor === 'function') {
      StatusBar.setBackgroundColor(colors.header, true);
    }
  }, [isDark, colors.header]);

  const value = useMemo(
    () => ({
      ready,
      preference,
      setPreference,
      setDarkMode,
      isDark,
      colors,
      /** Switch: on when user chose dark, or system is dark while following system */
      darkModeEnabled: preference === 'dark' || (preference === 'system' && isDark),
    }),
    [ready, preference, setPreference, setDarkMode, isDark, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
