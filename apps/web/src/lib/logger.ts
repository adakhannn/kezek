/**
 * Утилита для логирования
 * В продакшене можно расширить для отправки в сервис мониторинга
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Логирует ошибку
 */
export function logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (isDev) {
        console.error(`[ERROR] ${message}`, error, context);
    } else {
        // В продакшене можно отправлять в Sentry, LogRocket и т.д.
        console.error(`[ERROR] ${message}`, error, context);
    }
}

/**
 * Логирует предупреждение
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
    if (isDev) {
        console.warn(`[WARN] ${message}`, context);
    } else {
        console.warn(`[WARN] ${message}`, context);
    }
}

/**
 * Логирует информационное сообщение (только в dev)
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
    if (isDev) {
        console.log(`[INFO] ${message}`, context);
    }
    // В продакшене не логируем info
}

