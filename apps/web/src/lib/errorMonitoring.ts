'use client';

import { logError, maskUrl } from './log';

/**
 * Структура полезной нагрузки для отправки ошибки во внешнюю систему мониторинга.
 *
 * `scope` — логический модуль/компонент, где произошла ошибка (например, 'BookingForm').
 * `error` — нормализованная информация об ошибке (имя, сообщение, stack).
 * `componentStack` — React component stack (передаётся из ErrorBoundary).
 * `url` / `userAgent` — дополнительный контекст окружения.
 * `timestamp` — ISO‑время возникновения ошибки.
 * `extra` — любые дополнительные данные (payload, user, feature‑flags и т.д.).
 */
type ErrorMonitoringPayload = {
    scope: string;
    error: {
        name: string;
        message: string;
        stack?: string | null;
    };
    componentStack?: string | null;
    url?: string | null;
    userAgent?: string | null;
    timestamp: string;
    extra?: Record<string, unknown>;
};

/**
 * Отправляет ошибку ErrorBoundary в мониторинг (ARCH-04).
 *
 * Ошибка уходит через logError: логгер передаёт её в мониторинг (Sentry при заданном
 * NEXT_PUBLIC_SENTRY_DSN, инициализация в instrumentation-client.ts) один раз, с очищенным
 * контекстом; без DSN остаётся строка в консоли. URL маскируется, component stack обрезается.
 * LogRocket, если подключён на странице, получает ту же ошибку.
 */
export function reportErrorToMonitoring(payload: ErrorMonitoringPayload) {
    try {
        const error = new Error(payload.error.message);
        error.name = payload.error.name;
        if (payload.error.stack) {
            error.stack = payload.error.stack;
        }

        const context = {
            componentStack: payload.componentStack?.slice(0, 2000),
            url: payload.url ? maskUrl(payload.url) : undefined,
            timestamp: payload.timestamp,
            extra: payload.extra,
        };
        logError(payload.scope, 'Captured error (ErrorBoundary)', { error, ...context });

        if (typeof window !== 'undefined') {
            const logRocket = (window as unknown as {
                LogRocket?: { captureException?: (error: unknown, context?: { extra?: unknown }) => void };
            }).LogRocket;
            logRocket?.captureException?.(error, { extra: { scope: payload.scope, ...context } });
        }
    } catch (err) {
        // В крайнем случае просто логируем сбой репортинга
        logError('ErrorMonitoring', 'Failed to report error to monitoring', err);
    }
}
