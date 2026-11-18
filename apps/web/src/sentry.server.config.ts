/**
 * Sentry — инициализация на сервере (Node.js). Без DSN ничего не отправляется.
 * ARCH-04: только ошибки (без трассировки), без cookies, тел и query запросов; каждое событие и
 * хлебная крошка очищаются (sentryMonitoring.ts); залогированные ошибки уходят через репортёр.
 */
import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';

import { setMonitoringReporter } from './lib/monitoring';
import { createSentryReporter, safeBeforeSend, scrubBreadcrumb } from './lib/sentryMonitoring';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        // environment: SDK default (SENTRY_ENVIRONMENT, then vercel-<env>, then NODE_ENV).
        enabled: process.env.NODE_ENV === 'production',
        sendDefaultPii: false,
        integrations: [
            // The Next.js SDK's own Http integration (Next.js traces incoming requests itself), and
            // request bodies are never read.
            Sentry.httpIntegration({ disableIncomingRequestSpans: true, maxIncomingRequestBodySize: 'none' }),
            Sentry.requestDataIntegration({ include: { cookies: false, data: false, query_string: false, ip: false } }),
        ],
        beforeSend: (event) => safeBeforeSend(event, { dropConsole: true }),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb, { dropConsole: true }),
    });
    setMonitoringReporter(createSentryReporter(Sentry, {
        server: true,
        scheduleFlush: (task) => {
            try {
                after(task);
            } catch {
                // Outside a request scope: flush right away.
                void task();
            }
        },
    }));
}
