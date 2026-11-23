/**
 * The app languages and the language of outgoing API requests.
 *
 * LanguageProvider keeps the current locale here as well as in React state, so non-React code
 * (lib/api.ts, lib/fetchWithTimeout.ts) can send it as the `X-Kezek-Locale` header. The web API
 * answers its `message`/`error` fields in that language (apps/web/src/lib/serverMessages.ts).
 */
export type Locale = 'ru' | 'ky' | 'en';

/** Display order of the language switcher, as on the website: KG / RU / EN. */
export const LOCALES: readonly Locale[] = ['ky', 'ru', 'en'];

export const DEFAULT_LOCALE: Locale = 'ru';

/** Request header with the app language; the web API reads it after the `kezek_lang` cookie. */
export const LOCALE_HEADER = 'X-Kezek-Locale';

export function isLocale(value: unknown): value is Locale {
    return value === 'ru' || value === 'ky' || value === 'en';
}

let requestLocale: Locale = DEFAULT_LOCALE;

/** The language sent with API requests: the one LanguageProvider shows. */
export function getRequestLocale(): Locale {
    return requestLocale;
}

export function setRequestLocale(locale: Locale): void {
    requestLocale = locale;
}

/**
 * The request headers plus `X-Kezek-Locale`. A header the caller set itself (in any letter case)
 * is kept.
 */
export function withLocaleHeader(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};
    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            result[key] = value;
        });
    } else if (Array.isArray(headers)) {
        for (const [key, value] of headers) result[key] = value;
    } else if (headers) {
        Object.assign(result, headers);
    }
    const hasLocale = Object.keys(result).some((key) => key.toLowerCase() === LOCALE_HEADER.toLowerCase());
    if (!hasLocale) result[LOCALE_HEADER] = requestLocale;
    return result;
}
