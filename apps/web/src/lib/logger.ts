/**
 * Утилита для логирования
 * @deprecated Используйте @/lib/log вместо этого модуля
 * Этот модуль оставлен для обратной совместимости
 * 
 * В продакшене можно расширить для отправки в сервис мониторинга
 */

import { logError as logErrorSafe, logWarn as logWarnSafe, logDebug } from './log';

/**
 * Логирует ошибку
 * @deprecated Используйте logError из @/lib/log
 */
export function logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
    logErrorSafe('LegacyLogger', message, error || context);
}

/**
 * Логирует предупреждение
 * @deprecated Используйте logWarn из @/lib/log
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
    logWarnSafe('LegacyLogger', message, context);
}

/**
 * Логирует информационное сообщение (только в dev)
 * @deprecated Используйте logDebug из @/lib/log
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
    logDebug('LegacyLogger', message, context);
}


