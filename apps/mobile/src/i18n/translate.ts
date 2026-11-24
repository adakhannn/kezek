import { en } from './dictionaries/en';
import { ky } from './dictionaries/ky';
import { ru, type Dictionary, type MobileI18nKey } from './dictionaries/ru';
import type { Locale } from './locale';

export type TranslateParams = Readonly<Record<string, string | number>>;

/**
 * t(key), t(key, params), t(key, fallback) or t(key, fallback, params).
 * `{name}` in the text is replaced by params.name, every occurrence, in one pass: a value is
 * inserted as it is, so a `{name}` inside a value (a client named "{service}") stays.
 */
export type Translate = {
    (key: MobileI18nKey, params?: TranslateParams): string;
    (key: MobileI18nKey, fallback: string | undefined, params?: TranslateParams): string;
    /**
     * The language of the texts. Helpers that get only `t` read it: getErrorMessage (which
     * script a readable message is in) and translatePlural (which plural form).
     */
    readonly locale: Locale;
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
    const text: string = has(dictionary, key) ? dictionary[key] : has(ru, key) ? ru[key] : fallback ?? key;
    if (!params) return text;
    // One pass over the text: an inserted value is never searched for placeholders again.
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

/** t() in `locale`; the function also carries the language as `t.locale`. */
export function createTranslate(locale: Locale): Translate {
    const t = (key: MobileI18nKey, fallbackOrParams?: string | TranslateParams, params?: TranslateParams) =>
        translate(locale, key, fallbackOrParams, params);
    return Object.assign(t, { locale }) as Translate;
}
