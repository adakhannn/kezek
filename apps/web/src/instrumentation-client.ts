/**
 * Sentry — инициализация в браузере. Next.js загружает этот файл сам, в том числе под Turbopack
 * (прежний sentry.client.config.ts подключался только webpack-плагином и под Turbopack не работал).
 * ARCH-04: только ошибки, без трассировки и Session Replay; события очищаются (sentryMonitoring.ts),
 * залогированные ошибки и ErrorBoundary уходят через репортёр логгера.
 */
import * as Sentry from '@sentry/nextjs';

import { setMonitoringReporter } from './lib/monitoring';
import { createSentryReporter, safeBeforeSend, scrubBreadcrumb } from './lib/sentryMonitoring';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        enabled: process.env.NODE_ENV === 'production',
        sendDefaultPii: false,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        ignoreErrors: [
            /AbortError/,
            /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/,
        ],
        beforeSend: (event) => safeBeforeSend(event, { dropConsole: false }),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb, { dropConsole: false }),
    });
    setMonitoringReporter(createSentryReporter(Sentry, { server: false }));
}
