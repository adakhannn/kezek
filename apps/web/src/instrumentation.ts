/**
 * Next.js Instrumentation: регистрация Sentry для сервера и edge.
 * Клиентская инициализация — в instrumentation-client.ts (Next.js загружает его сам, также под Turbopack).
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }
}

export const onRequestError = Sentry.captureRequestError;
