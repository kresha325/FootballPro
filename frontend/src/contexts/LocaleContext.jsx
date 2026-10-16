import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from '../locales/catalog';

const LANGUAGE_KEY = 'xt_language';
const LocaleContext = createContext(null);

function readLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved || 'sq';
  } catch {
    return 'sq';
  }
}

export function LocaleProvider({ children }) {
  const [language, setCurrentLanguage] = useState(readLanguage);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next) => {
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* storage may be unavailable */ }
    document.documentElement.lang = next;
    setCurrentLanguage(next);
  }, []);
  const t = useCallback((key) => translate(language, key), [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}

export { LANGUAGE_KEY };
