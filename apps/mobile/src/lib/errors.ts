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
 * text is Russian. The fallback is already translated by the caller.
 */
export function getErrorMessage(
    error: unknown,
    fallbackMessage?: string,
    t: Translate = translateRu,
): string {
    const errorLike = asErrorLike(error);
    const rawMessage = getRawErrorMessage(error).trim();
    const status = getStatus(error);

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
        return hasCyrillic(rawMessage) && !isTechnicalMessage(rawMessage)
            ? rawMessage
            : t('cabinet.error.invalidInput');
    }
    if (status !== undefined && status >= 500) {
        return t('cabinet.error.unavailable');
    }
    if (/rate limit|too many requests/i.test(rawMessage) || status === 429) {
        return t('cabinet.error.rateLimited');
    }
    if (rawMessage && hasCyrillic(rawMessage) && !isTechnicalMessage(rawMessage)) {
        return rawMessage;
    }

    return fallbackMessage ?? t('cabinet.error.default');
}
