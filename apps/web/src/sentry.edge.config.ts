/**
 * Sentry — инициализация в Edge runtime. Без DSN ничего не отправляется.
 * ARCH-04: только ошибки, события и хлебные крошки очищаются (sentryMonitoring.ts).
 */
import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';

import { setMonitoringReporter } from './lib/monitoring';
import { createSentryReporter, safeBeforeSend, scrubBreadcrumb } from './lib/sentryMonitoring';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        enabled: process.env.NODE_ENV === 'production',
        sendDefaultPii: false,
        beforeSend: (event) => safeBeforeSend(event, { dropConsole: true }),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb, { dropConsole: true }),
    });
    setMonitoringReporter(createSentryReporter(Sentry, {
        server: true,
        scheduleFlush: (task) => {
            try {
                after(task);
            } catch {
                void task();
            }
        },
    }));
}
