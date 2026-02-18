'use client';

import { logError } from './log';

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
 * Отправка ошибок в внешнюю систему мониторинга (Sentry, LogRocket и т.п.)
 * Реализация построена так, чтобы не тянуть конкретные SDK в бандл:
 *  - если на window есть Sentry/LogRocket, используем их
 *  - иначе просто логируем через logError
 */
export function reportErrorToMonitoring(payload: ErrorMonitoringPayload) {
    try {
        if (typeof window === 'undefined') {
            // На сервере просто логируем
            logError(payload.scope, 'Captured error on server', payload);
            return;
        }

        const withContext = {
            ...payload,
        };

        const anyWindow = window as unknown as {
            Sentry?: {
                captureException: (error: unknown, context?: { tags?: Record<string, string>; extra?: unknown }) => void;
            };
            LogRocket?: {
                captureException: (error: unknown, context?: { extra?: unknown }) => void;
            };
        };

        const baseError = new Error(payload.error.message);
        baseError.name = payload.error.name;
        if (payload.error.stack) {
            baseError.stack = payload.error.stack;
        }

        // Интеграция с Sentry, если подключен на проекте
        if (anyWindow.Sentry?.captureException) {
            anyWindow.Sentry.captureException(baseError, {
                tags: {
                    scope: payload.scope,
                },
                extra: withContext,
            });
        }

        // Интеграция с LogRocket, если подключен
        if (anyWindow.LogRocket?.captureException) {
            anyWindow.LogRocket.captureException(baseError, {
                extra: withContext,
            });
        }

        // Всегда логируем локально как fallback
        logError(payload.scope, 'Captured error (ErrorBoundary)', withContext);
    } catch (err) {
        // В крайнем случае просто логируем сбой репортинга
        logError('ErrorMonitoring', 'Failed to report error to monitoring', {
            reportError: payload,
            error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
        });
    }
}


