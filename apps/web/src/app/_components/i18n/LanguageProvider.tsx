'use client';

import {createContext, useContext, useEffect, useMemo, useSyncExternalStore} from 'react';

import { ky as kyModules, ru as ruModules, en as enModules, type I18nKey } from './dictionaries';

import { getLocaleFromCookie, setLocaleInCookie } from '@/lib/cookies';
import { logWarn } from '@/lib/log';

type Locale = 'ky' | 'ru' | 'en';

export type Translations = Record<string, string>;

type Dictionaries = Record<Locale, Translations>;

const STORAGE_KEY = 'kezek_locale'; // Для обратной совместимости с localStorage
const LOCALE_CHANGED = 'kezek-locale-changed';

const defaultLocale: Locale = 'ru';

// Re-export I18nKey для удобства использования в других местах
export type { I18nKey };

const dictionaries: Dictionaries = {
    ky: kyModules,
    ru: ruModules,
    en: enModules,
};

// Старые встроенные словари удалены - теперь используются модули из dictionaries/

interface LanguageContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: <K extends I18nKey>(key: K, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/** Fallback when useLanguage is used outside LanguageProvider (e.g. streaming/hydration edge case). */
const fallbackContextValue: LanguageContextValue = {
    locale: defaultLocale,
    setLocale: () => {},
    t: (key, fallback) => fallback ?? (typeof key === 'string' ? key : ''),
};

function isLocale(value: unknown): value is Locale {
    return value === 'ru' || value === 'ky' || value === 'en';
}

function readClientLocale(fallback: Locale): Locale {
    if (typeof window === 'undefined') return fallback;
    const cookie = getLocaleFromCookie();
    if (cookie) return cookie;
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (isLocale(saved)) return saved;
    } catch { /* A blocked legacy store must not prevent the browser fallback. */ }
    const browser = window.navigator.language.slice(0, 2);
    return isLocale(browser) ? browser : fallback;
}

function persistLocale(locale: Locale) {
    setLocaleInCookie(locale);
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* Keep the current tab usable. */ }
    document.documentElement.lang = locale;
}

function createLocaleStore(fallback: Locale) {
    // Only an explicit choice that could not be persisted needs an in-memory fallback.
    let transientLocale: Locale | null = null;
    const getSnapshot = () => transientLocale ?? readClientLocale(fallback);
    const subscribe = (notify: () => void) => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== STORAGE_KEY) return;
            transientLocale = null;
            notify();
        };
        const onChange = (event: Event) => {
            const next: unknown = (event as CustomEvent<unknown>).detail;
            if (!isLocale(next)) return;
            transientLocale = readClientLocale(fallback) === next ? null : next;
            notify();
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener(LOCALE_CHANGED, onChange);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(LOCALE_CHANGED, onChange);
        };
    };
    const setLocale = (next: Locale) => {
        persistLocale(next);
        transientLocale = readClientLocale(fallback) === next ? null : next;
        window.dispatchEvent(new CustomEvent(LOCALE_CHANGED, { detail: next }));
    };
    return { getSnapshot, subscribe, setLocale };
}

export function LanguageProvider({children, initialLocale = defaultLocale}: {
    children: React.ReactNode;
    initialLocale?: Locale;
}) {
    const store = useMemo(() => createLocaleStore(initialLocale), [initialLocale]);
    const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, () => initialLocale);

    useEffect(() => {
        // During hydration the rendered locale is still the server snapshot.
        // Persist the actual browser preference, never overwrite it with that snapshot.
        persistLocale(store.getSnapshot());
    }, [locale, store]);

    const value = useMemo<LanguageContextValue>(() => ({
        locale,
        setLocale: store.setLocale,
        t: <K extends I18nKey>(key: K, fallback?: string): string => {
            const dict = dictionaries[locale];
            if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
            if (Object.prototype.hasOwnProperty.call(dictionaries.ru, key)) return dictionaries.ru[key];
            return fallback ?? key;
        },
    }), [locale, store]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
            logWarn('useLanguage', 'Used outside LanguageProvider — using fallback (ru). Wrap the app in <LanguageProvider> in the root layout.');
        }
        return fallbackContextValue;
    }
    return ctx;
}


