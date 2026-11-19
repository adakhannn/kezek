/**
 * Crash and error reporting of the app (MOB-07). Off unless EXPO_PUBLIC_SENTRY_DSN is set, and never
 * in a development build (__DEV__). The SDK reports unhandled JS errors and native crashes; logged
 * errors and the ErrorBoundary reach it through the logger. Everything is scrubbed as on the web
 * (@shared-client/sentry): no default PII, no screenshots or view hierarchy, no performance tracing,
 * and no console breadcrumbs, because the logger reports its own warnings and errors.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { createSentryReporter, safeBeforeSend, scrubBreadcrumb } from '@shared-client/sentry';

import { setMonitoringReporter } from './monitoringSlot';

const SCRUB = { dropConsole: true } as const;

/** The build's environment from app.config.ts (production, preview or development). */
function appEnvironment(): string {
    const value = (Constants.expoConfig?.extra as { appEnv?: unknown } | undefined)?.appEnv;
    return typeof value === 'string' && value ? value : 'development';
}

/** Starts Sentry when configured; returns whether it did. Call once, before the app renders. */
export function initMonitoring(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN, isDev: boolean = __DEV__): boolean {
    const value = dsn?.trim();
    if (!value || isDev) return false;
    Sentry.init({
        dsn: value,
        environment: appEnvironment(),
        sendDefaultPii: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
        tracesSampleRate: 0,
        enableAutoPerformanceTracing: false,
        beforeSend: (event) => safeBeforeSend(event, SCRUB),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb, SCRUB),
    });
    setMonitoringReporter(createSentryReporter({
        // The React Native SDK has no isInitialized(); a client exists once init has run.
        isInitialized: () => Sentry.getClient() !== undefined,
        getIsolationScope: Sentry.getIsolationScope,
        withScope: Sentry.withScope,
        captureException: Sentry.captureException,
        captureMessage: Sentry.captureMessage,
        addBreadcrumb: Sentry.addBreadcrumb,
        flush: Sentry.flush,
    }, { server: false }));
    return true;
}
