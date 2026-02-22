/**
 * Безопасное логирование для клиентских приложений (web и mobile)
 * Автоматически маскирует чувствительные данные
 * 
 * @param isDev - Функция для определения dev режима (для web: () => process.env.NODE_ENV !== 'production', для mobile: () => __DEV__)
 */

import { sanitizeObject, maskToken, maskUrl } from './logSafe';

export type IsDevFn = () => boolean;

/**
 * Создаёт функции логирования с указанной функцией определения dev режима
 */
export function createLogger(isDev: IsDevFn) {
    /**
     * Безопасное логирование debug информации (только в dev)
     * Автоматически маскирует чувствительные данные
     */
    function logDebug(scope: string, message: string, extra?: unknown) {
        if (!isDev()) return;
        const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
        // eslint-disable-next-line no-console
        console.log(`[${scope}] ${message}`, sanitized ?? '');
    }

    /**
     * Безопасное логирование предупреждений (только в dev)
     * Автоматически маскирует чувствительные данные
     */
    function logWarn(scope: string, message: string, extra?: unknown) {
        if (!isDev()) return;
        const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
        // eslint-disable-next-line no-console
        console.warn(`[${scope}] ${message}`, sanitized ?? '');
    }

    /**
     * Безопасное логирование ошибок (в dev и prod)
     * Автоматически маскирует чувствительные данные
     */
    function logError(scope: string, message: string, extra?: unknown) {
        // Ошибки всегда логируем
        if (isDev()) {
            const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
            // eslint-disable-next-line no-console
            console.error(`[${scope}] ${message}`, sanitized ?? '');
        } else {
            // В production логируем только сообщение без деталей (для mobile)
            // eslint-disable-next-line no-console
            console.error(`[${scope}] ${message}`);
        }
    }

    return {
        logDebug,
        logWarn,
        logError,
    };
}

/**
 * Экспортируем утилиты для маскирования
 */
export { maskToken, maskUrl, sanitizeObject } from './logSafe';

