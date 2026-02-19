import { sanitizeObject, maskToken } from './logSafe';

// В React Native/Expo используем __DEV__ для определения dev режима
const isDev = __DEV__;

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
    // eslint-disable-next-line no-console
    console.warn(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Безопасное логирование ошибок (в dev и prod)
 * Автоматически маскирует чувствительные данные
 * 
 * В production ошибки логируются для мониторинга, но без детальной информации
 */
export function logError(scope: string, message: string, extra?: unknown) {
    // Ошибки всегда логируем, но в production с минимальной информацией
    if (isDev) {
        const sanitized = extra !== undefined ? sanitizeObject(extra) : undefined;
        // eslint-disable-next-line no-console
        console.error(`[${scope}] ${message}`, sanitized ?? '');
    } else {
        // В production логируем только сообщение без деталей
        // eslint-disable-next-line no-console
        console.error(`[${scope}] ${message}`);
    }
}

/**
 * Экспортируем утилиты для маскирования
 */
export { maskToken, maskUrl } from './logSafe';

