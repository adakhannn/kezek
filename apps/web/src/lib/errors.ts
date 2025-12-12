/**
 * Утилиты для форматирования ошибок
 */

/**
 * Форматирует ошибку в строку для отображения пользователю.
 * Поддерживает Error, объекты с message/details/hint/code (Postgres ошибки), и другие типы.
 */
export function formatError(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }

    if (e && typeof e === 'object') {
        const err = e as { message?: string; details?: string; hint?: string; code?: string };
        if (err.message) {
            const parts = [
                err.message,
                err.details && `Details: ${err.details}`,
                err.hint && `Hint: ${err.hint}`,
                err.code && `Code: ${err.code}`,
            ].filter(Boolean);
            return parts.join('\n');
        }
    }

    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

/**
 * Простая версия форматирования ошибки (только message или строка).
 * Используется в большинстве случаев для API responses.
 */
export function formatErrorSimple(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }
    return String(e);
}

/**
 * Проверяет, является ли ошибка определённым типом (по message).
 */
export function isErrorType(e: unknown, type: string): boolean {
    if (e instanceof Error) {
        return e.message === type;
    }
    if (e && typeof e === 'object' && 'message' in e) {
        return (e as { message?: string }).message === type;
    }
    return false;
}


