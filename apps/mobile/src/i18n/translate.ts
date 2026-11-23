import { en } from './dictionaries/en';
import { ky } from './dictionaries/ky';
import { ru, type Dictionary, type MobileI18nKey } from './dictionaries/ru';
import type { Locale } from './locale';

export type TranslateParams = Readonly<Record<string, string | number>>;

/**
 * t(key), t(key, params), t(key, fallback) or t(key, fallback, params).
 * `{name}` in the text is replaced by params.name, every occurrence.
 */
export type Translate = {
    (key: MobileI18nKey, params?: TranslateParams): string;
    (key: MobileI18nKey, fallback: string | undefined, params?: TranslateParams): string;
};

export const dictionaries: Readonly<Record<Locale, Dictionary>> = { ru, ky, en };

function has(dictionary: Dictionary, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(dictionary, key);
}

/**
 * The text of `key` in `locale`: else the Russian text, else `fallback`, else the key itself.
 * The fallback only matters for a key that is in no dictionary, which the type system and
 * `node scripts/check-i18n.mjs` prevent.
 */
export function translate(
    locale: Locale,
    key: MobileI18nKey,
    fallbackOrParams?: string | TranslateParams,
    maybeParams?: TranslateParams,
): string {
    const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined;
    const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;
    const dictionary = dictionaries[locale] ?? ru;
    let text: string = has(dictionary, key) ? dictionary[key] : has(ru, key) ? ru[key] : fallback ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.split(`{${name}}`).join(String(value));
        }
    }
    return text;
}

export function createTranslate(locale: Locale): Translate {
    return ((key: MobileI18nKey, fallbackOrParams?: string | TranslateParams, params?: TranslateParams) =>
        translate(locale, key, fallbackOrParams, params)) as Translate;
}
