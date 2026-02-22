/**
 * Sentry — инициализация на клиенте.
 * При наличии NEXT_PUBLIC_SENTRY_DSN ошибки отправляются в Sentry;
 * обёртка errorMonitoring.ts использует window.Sentry, выставленный здесь.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        enabled: process.env.NODE_ENV === 'production',
        tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
        integrations: [
            ...(process.env.NODE_ENV === 'production'
                ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
                : []),
        ],
    });

    if (typeof window !== 'undefined') {
        (window as unknown as { Sentry?: typeof Sentry }).Sentry = Sentry;
    }
}
