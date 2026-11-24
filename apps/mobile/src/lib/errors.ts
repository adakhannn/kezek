import type { Locale } from '../i18n/locale';
import { createTranslate, type Translate } from '../i18n/translate';

/** Russian, for callers outside a screen (tests, logging) that pass no `t`. */
const translateRu: Translate = createTranslate('ru');

type ErrorLike = {
    message?: unknown;
    name?: unknown;
    status?: unknown;
};

function asErrorLike(error: unknown): ErrorLike | null {
    if (error instanceof Error) {
        return error as Error & ErrorLike;
    }
    return error && typeof error === 'object' ? (error as ErrorLike) : null;
}

export function getRawErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;

    const message = asErrorLike(error)?.message;
    return typeof message === 'string' ? message : '';
}

function getStatus(error: unknown): number | undefined {
    const status = asErrorLike(error)?.status;
    if (typeof status === 'number') return status;

    const match = getRawErrorMessage(error).match(/\b(?:HTTP\s*)?([45]\d{2})\b/i);
    return match ? Number(match[1]) : undefined;
}

function hasCyrillic(value: string): boolean {
    return /[А-Яа-яЁё]/.test(value);
}

/**
 * Written in the script of the UI language. ru and ky: it has Cyrillic, as before translations.
 * en: most of its letters are Latin, so an English text naming a Cyrillic business is English and a
 * Russian text naming a Latin one is not.
 */
function isInScriptOf(value: string, locale: Locale): boolean {
    if (locale !== 'en') return hasCyrillic(value);
    const latin = value.match(/[A-Za-z]/g)?.length ?? 0;
    const cyrillic = value.match(/[А-Яа-яЁёҢңӨөҮү]/g)?.length ?? 0;
    return latin > cyrillic;
}

function isTechnicalMessage(value: string): boolean {
    return [
        /\btypeerror\b/i,
        /\bsyntaxerror\b/i,
        /\bnetwork request failed\b/i,
        /\bfailed to fetch\b/i,
        /\bnetworkerror\b/i,
        /\bhttp\s*[45]\d{2}\b/i,
        /\b(jwt|postgrest|pgrst\d+|supabase)\b/i,
        /\b(stack|trace|exception)\b/i,
        /\bundefined\b|\bnull\b/i,
        /<html|<!doctype/i,
    ].some((pattern) => pattern.test(value));
}

export function isNetworkError(error: unknown): boolean {
    return /network|failed to fetch|internet|соединени|сети/i.test(getRawErrorMessage(error));
}

export function isAuthError(error: unknown): boolean {
    const status = getStatus(error);
    return (
        status === 401 ||
        /unauthorized|not authenticated|jwt|session expired|401|требуется авторизац|сессия истек/i.test(
            getRawErrorMessage(error),
        )
    );
}

/**
 * A message for the user. `t` is the screen's translator (`useLanguage().t`); without it the
 * text is Russian. The error's own message is shown when it is readable: written in the script of
 * `t.locale` (Cyrillic for ru and ky, Latin for en) and not technical. That keeps a server answer
 * in the app's language and a client error thrown with t() text. The fallback is already
 * translated by the caller.
 */
export function getErrorMessage(
    error: unknown,
    fallbackMessage?: string,
    t: Translate = translateRu,
): string {
    const errorLike = asErrorLike(error);
    const rawMessage = getRawErrorMessage(error).trim();
    const status = getStatus(error);
    const readable = rawMessage !== '' && isInScriptOf(rawMessage, t.locale) && !isTechnicalMessage(rawMessage);

    if (
        errorLike?.name === 'TimeoutError' ||
        /timed out|timeout|время ожидания/i.test(rawMessage)
    ) {
        return t('cabinet.error.timeout');
    }
    if (isNetworkError(error)) {
        return t('cabinet.error.network');
    }
    if (status === 401 || isAuthError(error)) {
        return t('cabinet.error.sessionExpired');
    }
    if (status === 403) {
        return t('cabinet.error.forbidden');
    }
    if (status === 404 || /\bnot found\b/i.test(rawMessage)) {
        return t('cabinet.error.notFound');
    }
    if (status === 409 || /\bconflict\b|already exists|duplicate/i.test(rawMessage)) {
        return t('cabinet.error.conflict');
    }
    if (status === 400 || status === 422) {
        return readable ? rawMessage : t('cabinet.error.invalidInput');
    }
    if (status !== undefined && status >= 500) {
        return t('cabinet.error.unavailable');
    }
    if (/rate limit|too many requests/i.test(rawMessage) || status === 429) {
        return t('cabinet.error.rateLimited');
    }
    if (readable) {
        return rawMessage;
    }

    return fallbackMessage ?? t('cabinet.error.default');
}
