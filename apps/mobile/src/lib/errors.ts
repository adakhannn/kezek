const DEFAULT_ERROR_MESSAGE = 'Что-то пошло не так. Попробуйте снова.';
const NETWORK_ERROR_MESSAGE =
    'Нет подключения к интернету. Проверьте соединение и попробуйте снова.';
const TIMEOUT_ERROR_MESSAGE =
    'Сервер не ответил вовремя. Проверьте соединение и попробуйте снова.';

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

export function getErrorMessage(
    error: unknown,
    fallbackMessage = DEFAULT_ERROR_MESSAGE,
): string {
    const errorLike = asErrorLike(error);
    const rawMessage = getRawErrorMessage(error).trim();
    const status = getStatus(error);

    if (
        errorLike?.name === 'TimeoutError' ||
        /timed out|timeout|время ожидания/i.test(rawMessage)
    ) {
        return TIMEOUT_ERROR_MESSAGE;
    }
    if (isNetworkError(error)) {
        return NETWORK_ERROR_MESSAGE;
    }
    if (status === 401 || isAuthError(error)) {
        return 'Сессия истекла. Войдите в аккаунт снова.';
    }
    if (status === 403) {
        return 'У вас недостаточно прав для этого действия.';
    }
    if (status === 404 || /\bnot found\b/i.test(rawMessage)) {
        return 'Запрошенные данные не найдены.';
    }
    if (status === 409 || /\bconflict\b|already exists|duplicate/i.test(rawMessage)) {
        return 'Данные уже изменились. Обновите экран и попробуйте снова.';
    }
    if (status === 400 || status === 422) {
        return hasCyrillic(rawMessage) && !isTechnicalMessage(rawMessage)
            ? rawMessage
            : 'Проверьте введенные данные и попробуйте снова.';
    }
    if (status !== undefined && status >= 500) {
        return 'Сервис временно недоступен. Попробуйте позже.';
    }
    if (/rate limit|too many requests/i.test(rawMessage) || status === 429) {
        return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    }
    if (rawMessage && hasCyrillic(rawMessage) && !isTechnicalMessage(rawMessage)) {
        return rawMessage;
    }

    return fallbackMessage;
}
