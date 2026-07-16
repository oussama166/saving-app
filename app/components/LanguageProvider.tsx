'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t as translate, type Locale, DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

const LOCALE_STORAGE_KEY = 'wealth-os-locale';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale,
  authenticated,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
  authenticated: boolean;
}) {
  // `initialLocale` vient du serveur (UserSettings.language si connecté,
  // sinon 'fr') — le tout premier rendu client démarre sur la même valeur,
  // donc pas de mismatch d'hydratation sur le texte traduit.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const didMount = useRef(false);
  const router = useRouter();

  // Pages non authentifiées (login/signup) uniquement : le serveur ne peut
  // pas connaître la préférence avant connexion, donc on la relit depuis
  // localStorage après le montage (mise à jour client normale, pas un
  // mismatch d'hydratation puisqu'elle a lieu après coup).
  useEffect(() => {
    if (didMount.current || authenticated) return;
    didMount.current = true;
    const raf = requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== locale) setLocaleState(stored);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      if (authenticated) {
        // Les composants clients (via useLanguage()) se retraduisent
        // instantanément grâce à setLocaleState ci-dessus. Mais le texte
        // rendu par les Server Components (ex: app/sante/page.tsx via
        // getUserLocale()) est figé au moment du rendu serveur initial —
        // il faut donc explicitement redemander un rendu serveur une fois
        // la préférence persistée en base, sinon ce texte reste dans
        // l'ancienne langue jusqu'à la prochaine navigation.
        fetch('/api/settings/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: next }),
        })
          .then(() => router.refresh())
          .catch(() => {});
      }
    },
    [authenticated, router],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string, fallback?: string) => translate(locale, key, fallback),
    }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

export { DEFAULT_LOCALE };
