/**
 * Compatibility API backed by the shared redacting logger.
 * Legacy info/warn/error remain enabled in production; debug remains dev-only.
 * New application diagnostics normally use ./log (dev-only debug/warn).
 */
import { createLogger } from '@shared-client/log';

export { sanitizeObject, maskToken, maskUrl } from '@shared-client/log';

// Preserve this API's existing production policy without changing severity.
const alwaysLogger = createLogger(() => true);
const debugLogger = createLogger(() => process.env.NODE_ENV !== 'production');

export function logSafe(scope: string, message: string, data?: unknown): void {
    alwaysLogger.logDebug(scope, message, data);
}

export function logErrorSafe(scope: string, message: string, error?: unknown): void {
    alwaysLogger.logError(scope, message, error);
}

export function logWarnSafe(scope: string, message: string, data?: unknown): void {
    alwaysLogger.logWarn(scope, message, data);
}

export function logDebugSafe(scope: string, message: string, data?: unknown): void {
    debugLogger.logDebug(scope, message, data);
}
