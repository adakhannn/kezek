/**
 * Утилиты для форматирования и классификации ошибок
 */

type MaybeDomainError = {
    kind?: string;
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
};

/**
 * Форматирует ошибку в строку для отображения пользователю.
 * Поддерживает:
 * - Error
 * - доменные ошибки с полем kind/message
 * - объекты Postgres (message/details/hint/code)
 * - прочие типы (JSON.stringify/String)
 */
export function formatError(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }

    if (e && typeof e === 'object') {
        const err = e as MaybeDomainError;

        // Если это доменная ошибка с kind/message
        if (err.message || err.kind) {
            const base = err.message || err.kind;
            const parts = [
                base,
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
 * Простая версия форматирования ошибки (только message/kind или строка).
 * Используется в большинстве случаев для API responses.
 */
export function formatErrorSimple(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }
    if (e && typeof e === 'object') {
        const err = e as MaybeDomainError;
        return err.message || err.kind || String(e);
    }
    return String(e);
}

/**
 * Проверяет, является ли ошибка определённым типом.
 * Сначала смотрит на err.kind / err.code, затем на message.
 */
export function isErrorType(e: unknown, type: string): boolean {
    if (e && typeof e === 'object') {
        const err = e as MaybeDomainError;
        if (err.kind === type || err.code === type) {
            return true;
        }
        if (err.message === type) {
            return true;
        }
    }

    if (e instanceof Error) {
        return e.message === type;
    }

    return false;
}

