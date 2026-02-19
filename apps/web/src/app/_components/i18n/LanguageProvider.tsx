'use client';

import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import { getLocaleFromCookie, setLocaleInCookie } from '@/lib/cookies';

type Locale = 'ky' | 'ru' | 'en';

export type Translations = Record<string, string>;

type Dictionaries = Record<Locale, Translations>;

const STORAGE_KEY = 'kezek_locale'; // Для обратной совместимости с localStorage

const defaultLocale: Locale = 'ru';

/**
 * Серверная функция для получения локали из cookie
 * Используется в server components для определения текущей локали
 */
export async function getServerLocale(): Promise<Locale> {
    try {
        const { getLocaleFromCookieServer } = await import('@/lib/cookies');
        const cookieLocale = await getLocaleFromCookieServer();
        if (cookieLocale) {
            return cookieLocale;
        }
    } catch {
        // ignore
    }
    return defaultLocale;
}

/**
 * Серверная функция для получения переводов в server components
 * 
 * @param locale - Если передана локаль, функция работает синхронно и использует её
 *                 Если не передана, функция работает асинхронно и читает локаль из cookie
 */
export function getT(locale: Locale): <K extends I18nKey>(key: K, fallback?: string) => string;
export function getT(): Promise<<K extends I18nKey>(key: K, fallback?: string) => string>;
export function getT(locale?: Locale): <K extends I18nKey>(key: K, fallback?: string) => string | Promise<<K extends I18nKey>(key: K, fallback?: string) => string> {
    // Если локаль передана, работаем синхронно
    if (locale) {
        return <K extends I18nKey>(key: K, fallback?: string): string => {
            const dict = dictionaries[locale] || {};
            if (Object.prototype.hasOwnProperty.call(dict, key)) {
                return dict[key];
            }
            const ruDict = dictionaries.ru || {};
            if (Object.prototype.hasOwnProperty.call(ruDict, key)) {
                return ruDict[key];
            }
            return fallback ?? key;
        };
    }
    
    // Если локаль не передана, работаем асинхронно и читаем из cookie
    return (async () => {
        let actualLocale: Locale = defaultLocale;
        
        try {
            const { getLocaleFromCookieServer } = await import('@/lib/cookies');
            const cookieLocale = await getLocaleFromCookieServer();
            if (cookieLocale) {
                actualLocale = cookieLocale;
            }
        } catch {
            // ignore, используем defaultLocale
        }
        
        return <K extends I18nKey>(key: K, fallback?: string): string => {
            const dict = dictionaries[actualLocale] || {};
            if (Object.prototype.hasOwnProperty.call(dict, key)) {
                return dict[key];
            }
            const ruDict = dictionaries.ru || {};
            if (Object.prototype.hasOwnProperty.call(ruDict, key)) {
                return ruDict[key];
            }
            return fallback ?? key;
        };
    })();
}

// Импорт модульных словарей
import { ky as kyModules, ru as ruModules, en as enModules, type I18nKey } from './dictionaries';

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

export function LanguageProvider({children}: {children: React.ReactNode}) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            // 1. Приоритет: cookie
            const cookieLocale = getLocaleFromCookie();
            if (cookieLocale) {
                setLocaleState(cookieLocale);
                // Синхронизируем с localStorage для обратной совместимости
                window.localStorage.setItem(STORAGE_KEY, cookieLocale);
                // Обновляем атрибут lang в <html>
                document.documentElement.lang = cookieLocale;
                return;
            }
            
            // 2. Fallback: localStorage (для обратной совместимости)
            const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
            if (saved && ['ky', 'ru', 'en'].includes(saved)) {
                setLocaleState(saved);
                // Синхронизируем с cookie
                setLocaleInCookie(saved);
                // Обновляем атрибут lang в <html>
                document.documentElement.lang = saved;
                return;
            }
            
            // 3. Fallback: браузерная локаль
            const browser = window.navigator.language.slice(0, 2);
            if (browser === 'ru' || browser === 'en' || browser === 'ky') {
                setLocaleState(browser as Locale);
                setLocaleInCookie(browser as Locale);
                // Обновляем атрибут lang в <html>
                document.documentElement.lang = browser as Locale;
            }
        } catch {
            // ignore
        }
    }, []);
    
    // Обновляем атрибут lang в <html> при изменении локали
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale]);

    const setLocale = (next: Locale) => {
        setLocaleState(next);
        if (typeof window !== 'undefined') {
            try {
                // Сохраняем в cookie (основной источник)
                setLocaleInCookie(next);
                // Сохраняем в localStorage для обратной совместимости
                window.localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // ignore
            }
        }
    };

    const t = <K extends I18nKey>(key: K, fallback?: string): string => {
        const dict = dictionaries[locale] || {};
        if (Object.prototype.hasOwnProperty.call(dict, key)) {
            return dict[key];
        }
        const ruDict = dictionaries.ru || {};
        if (Object.prototype.hasOwnProperty.call(ruDict, key)) {
            return ruDict[key];
        }
        return fallback ?? key;
    };

    const value = useMemo(
        () => ({
            locale,
            setLocale,
            t,
        }),
        [locale]
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return ctx;
}


