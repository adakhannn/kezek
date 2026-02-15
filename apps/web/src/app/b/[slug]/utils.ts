/**
 * Утилиты для формы бронирования
 */

/**
 * Форматирует ошибку для отображения пользователю
 */
type ErrorWithDetails = {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
};

export function fmtErr(e: unknown, t?: (key: string, fallback?: string) => string): string {
    if (e && typeof e === 'object') {
        const errorObj = e as ErrorWithDetails;
        const rawMessage = errorObj.message || '';

        // Пользовательский текст для частых бизнес-ошибок
        if (rawMessage.includes('is not assigned to branch')) {
            return t?.('booking.error.masterNotAssigned', 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.') || 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.';
        }

        if (errorObj.message) {
            const parts = [
                errorObj.message,
                errorObj.details && `Details: ${errorObj.details}`,
                errorObj.hint && `Hint: ${errorObj.hint}`,
                errorObj.code && `Code: ${errorObj.code}`,
            ].filter(Boolean);
            return parts.join('\n');
        }
    }
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

/**
 * Проверяет, является ли ошибка сетевой (например, недоступен интернет или сервер)
 */
type ErrorWithCode = {
    code?: string;
};

export function isNetworkError(e: unknown): boolean {
    if (e instanceof TypeError) {
        // Fetch в браузере выбрасывает TypeError при проблемах сети / CORS
        return true;
    }
    if (e && typeof e === 'object' && 'code' in e) {
        const errorWithCode = e as ErrorWithCode;
        // Некоторые драйверы могут использовать такие коды для сетевых ошибок
        if (errorWithCode.code === 'ECONNABORTED' || errorWithCode.code === 'ECONNREFUSED' || errorWithCode.code === 'ENETUNREACH') {
            return true;
        }
    }
    return false;
}

/**
 * Универсальный helper для повторной попытки при сетевых ошибках
 */
export async function withNetworkRetry<T>(
    fn: () => Promise<T>,
    options?: { retries?: number; delayMs?: number; scope?: string }
): Promise<T> {
    const retries = options?.retries ?? 1;
    const delayMs = options?.delayMs ?? 500;
    const scope = options?.scope ?? 'BookingFlow';

    let attempt = 0;

    while (true) {
        try {
            return await fn();
        } catch (e) {
            if (isNetworkError(e) && attempt < retries) {
                attempt += 1;
                const { logError } = await import('@/lib/log');
                logError(scope, `Network error, retrying attempt ${attempt}/${retries}`, e);
                await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
                continue;
            }
            throw e;
        }
    }
}

