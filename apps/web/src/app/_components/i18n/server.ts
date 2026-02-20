// Server-only i18n functions
// This file should NOT have 'use client' directive

import { ky as kyModules, ru as ruModules, en as enModules, type I18nKey } from './dictionaries';

type Locale = 'ky' | 'ru' | 'en';

type Translations = Record<string, string>;
type Dictionaries = Record<Locale, Translations>;

const defaultLocale: Locale = 'ru';

const dictionaries: Dictionaries = {
    ky: kyModules,
    ru: ruModules,
    en: enModules,
};

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
export function getT(locale?: Locale): (<K extends I18nKey>(key: K, fallback?: string) => string) | Promise<<K extends I18nKey>(key: K, fallback?: string) => string> {
    // Если локаль передана, работаем синхронно
    if (locale !== undefined) {
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
        return t as <K extends I18nKey>(key: K, fallback?: string) => string;
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

// Re-export I18nKey for convenience
export type { I18nKey };

