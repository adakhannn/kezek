import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import { DEFAULT_LOCALE, setRequestLocale, type Locale } from './locale';
import { readStoredLocale, saveStoredLocale } from './localeStorage';
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
 * The app language (Russian by default), stored in expo-secure-store. Mounted once in App.tsx,
 * outside ErrorBoundary, so the crash screen speaks it too.
 *
 * After each sign-in the language is saved in the profile, so the notifications follow the app,
 * when this device has an explicit choice: a stored language or a setLocale call. The default
 * Russian that nobody chose is not sent. A user and language pair is sent once per run; a
 * language change starts over, so signing back in after it sends the language again.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
    const [ready, setReady] = useState(false);
    const localeRef = useRef<Locale>(DEFAULT_LOCALE);
    // A setLocale call: made before the stored value arrives, it wins over that value.
    const chosenRef = useRef(false);
    // The device has an explicit choice: a stored language or a setLocale call.
    const explicitRef = useRef(false);
    // `${userId}:${locale}` pairs saved in the profile after a sign-in during this run.
    const syncedRef = useRef(new Set<string>());
    const loadedRef = useRef<Promise<void> | null>(null);

    const apply = useCallback((next: Locale) => {
        localeRef.current = next;
        setRequestLocale(next);
        setLocaleState(next);
    }, []);

    // Declared before the auth effect below, so loadedRef is set when that effect runs.
    useEffect(() => {
        let mounted = true;
        loadedRef.current = readStoredLocale().then((stored) => {
            if (stored === null) return;
            explicitRef.current = true;
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
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            const userId = session?.user?.id;
            if (event !== 'SIGNED_IN' || !userId) return;
            // Outside the auth callback: supabase-js must not be re-entered from inside it.
            setTimeout(() => {
                void loadedRef.current?.then(() => {
                    const pair = `${userId}:${localeRef.current}`;
                    if (!explicitRef.current || syncedRef.current.has(pair)) return;
                    syncedRef.current.add(pair);
                    void saveProfileLocale(localeRef.current);
                });
            }, 0);
        });
        return () => data?.subscription?.unsubscribe();
    }, []);

    const setLocale = useCallback((next: Locale) => {
        chosenRef.current = true;
        // Already the device's explicit choice: nothing to store or send.
        if (next === localeRef.current && explicitRef.current) return;
        explicitRef.current = true;
        // Signed in, the profile now gets `next`; signed out, it keeps what it had. Either way an
        // earlier pair is stale, and the next sign-in must send the language again.
        syncedRef.current.clear();
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
