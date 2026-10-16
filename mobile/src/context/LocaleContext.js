import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '../localization/catalog';

export const LANGUAGE_KEY = 'xt_language';
const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [language, setCurrentLanguage] = useState('sq');
  const [languageSelected, setLanguageSelected] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (!active) return;
      if (saved) {
        setCurrentLanguage(saved);
        setLanguageSelected(true);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback(async (next) => {
    setCurrentLanguage(next);
    setLanguageSelected(true);
    try { await AsyncStorage.setItem(LANGUAGE_KEY, next); } catch { /* keep the in-memory selection */ }
  }, []);
  const t = useCallback((key) => translate(language, key), [language]);
  const value = useMemo(() => ({ language, languageSelected, setLanguage, t }), [language, languageSelected, setLanguage, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
