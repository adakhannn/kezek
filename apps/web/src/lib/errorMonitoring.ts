'use client';

import { logError } from './log';

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
 * Отправляет информацию об ошибке во внешнюю систему мониторинга (Sentry, LogRocket и т.п.).
 *
 * Провайдер по умолчанию: Sentry. При заданном NEXT_PUBLIC_SENTRY_DSN инициализация в
 * sentry.client.config.ts выставляет window.Sentry, и все вызовы reportErrorToMonitoring
 * уходят в Sentry. См. документацию: PROJECT_DOCUMENTATION.md (раздел «Мониторинг ошибок»).
 *
 * Поведение:
 * - На сервере всегда логирует ошибку через `logError` (без обращения к `window`).
 * - В браузере пытается вызвать `window.Sentry.captureException` и/или `window.LogRocket.captureException`,
 *   добавляя в `extra` полный контекст `ErrorMonitoringPayload`.
 * - В любом случае делает локальный лог через `logError`, чтобы ошибка не потерялась даже без интеграций.
 *
 * Функция спроектирована так, чтобы не тянуть SDK мониторинга в основной бандл:
 * интеграции инициализируются отдельно и просто вешаются на `window`.
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


