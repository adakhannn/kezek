import { sanitizeObject, maskToken } from './logSafe';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Безопасное логирование debug информации (только в dev)
 * Автоматически маскирует чувствительные данные
 */
export function logDebug(scope: string, message: string, extra?: unknown) {
    if (!isDev) return;
    const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Безопасное логирование предупреждений (только в dev)
 * Автоматически маскирует чувствительные данные
 */
export function logWarn(scope: string, message: string, extra?: unknown) {
    if (!isDev) return;
    const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
    console.warn(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Безопасное логирование ошибок (в dev и prod)
 * Автоматически маскирует чувствительные данные
 */
export function logError(scope: string, message: string, extra?: unknown) {
    // Ошибки всегда логируем и в dev, и в prod
    const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
    console.error(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Экспортируем утилиты для маскирования
 */
export { maskToken, maskUrl } from './logSafe';


