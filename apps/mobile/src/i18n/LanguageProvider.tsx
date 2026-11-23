import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import { DEFAULT_LOCALE, setRequestLocale, type Locale } from './locale';
import { loadStoredLocale, saveStoredLocale } from './localeStorage';
import { saveProfileLocale } from './profileLocaleSync';
import { createTranslate, type Translate } from './translate';

export type LanguageContextValue = {
    locale: Locale;
    /** Shows, stores and sends the language; signed in, it is saved in the profile too. */
    setLocale: (locale: Locale) => void;
    t: Translate;
    /** False until the stored language is read; RootNavigator waits for it. */
    ready: boolean;
};

const russianContext: LanguageContextValue = {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: createTranslate(DEFAULT_LOCALE),
    ready: true,
};

const LanguageContext = createContext<LanguageContextValue>(russianContext);

/**
 * The app language (Russian by default), stored in expo-secure-store. Mounted once in App.tsx.
 * After a sign-in, a stored language other than Russian is saved in the profile once per user and
 * run, so the notifications follow the app from the first session.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
    const [ready, setReady] = useState(false);
    const localeRef = useRef<Locale>(DEFAULT_LOCALE);
    // An explicit choice made before the stored value arrives wins over it.
    const chosenRef = useRef(false);
    const loadedRef = useRef<Promise<void> | null>(null);

    const apply = useCallback((next: Locale) => {
        localeRef.current = next;
        setRequestLocale(next);
        setLocaleState(next);
    }, []);

    // Declared before the auth effect below, so loadedRef is set when that effect runs.
    useEffect(() => {
        let mounted = true;
        loadedRef.current = loadStoredLocale().then((stored) => {
            if (mounted && !chosenRef.current) apply(stored);
        });
        void loadedRef.current.finally(() => {
            if (mounted) setReady(true);
        });
        return () => {
            mounted = false;
        };
    }, [apply]);

    useEffect(() => {
        const syncedUsers = new Set<string>();
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            const userId = session?.user?.id;
            if (event !== 'SIGNED_IN' || !userId || syncedUsers.has(userId)) return;
            syncedUsers.add(userId);
            // Outside the auth callback: supabase-js must not be re-entered from inside it.
            setTimeout(() => {
                void loadedRef.current?.then(() => {
                    if (localeRef.current !== DEFAULT_LOCALE) void saveProfileLocale(localeRef.current);
                });
            }, 0);
        });
        return () => data?.subscription?.unsubscribe();
    }, []);

    const setLocale = useCallback((next: Locale) => {
        chosenRef.current = true;
        if (next === localeRef.current) return;
        apply(next);
        void saveStoredLocale(next);
        void saveProfileLocale(next);
    }, [apply]);

    const value = useMemo<LanguageContextValue>(
        () => ({ locale, setLocale, t: createTranslate(locale), ready }),
        [locale, setLocale, ready],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The app language and t(). Outside LanguageProvider (unit tests) it is Russian. */
export function useLanguage(): LanguageContextValue {
    return useContext(LanguageContext);
}
