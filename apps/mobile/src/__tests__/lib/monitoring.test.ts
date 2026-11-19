// MOB-07: crash and error reporting is off without a DSN and in development builds; when on, events
// are scrubbed as on the web and logged errors reach Sentry through the logger.
jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    getClient: jest.fn(() => ({})),
    getIsolationScope: jest.fn(() => ({})),
    withScope: jest.fn((callback: (scope: unknown) => void) => callback({ setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() })),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    flush: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra: { appEnv: 'preview' } } },
}));

import { initMonitoring } from '../../lib/monitoring';
import { logError, logWarn } from '../../lib/log';
import { setMonitoringReporter } from '../../lib/monitoringSlot';

const mockSentry = jest.requireMock('@sentry/react-native') as Record<string, jest.Mock>;

type InitOptions = {
    dsn: string;
    environment: string;
    sendDefaultPii: boolean;
    attachScreenshot: boolean;
    attachViewHierarchy: boolean;
    tracesSampleRate: number;
    beforeSend: (event: Record<string, unknown>) => Record<string, unknown> | null;
    beforeBreadcrumb: (breadcrumb: Record<string, unknown>) => Record<string, unknown> | null;
};

describe('mobile monitoring (MOB-07)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setMonitoringReporter(undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    test('stays off without a DSN and in development builds', () => {
        expect(initMonitoring(undefined, false)).toBe(false);
        expect(initMonitoring('  ', false)).toBe(false);
        expect(initMonitoring('https://key@sentry.example/1', true)).toBe(false);
        expect(mockSentry.init).not.toHaveBeenCalled();
        logError('Test', 'failure', { error: new Error('boom') });
        expect(mockSentry.captureException).not.toHaveBeenCalled();
    });

    test('starts with no PII, screenshots, view hierarchy or tracing', () => {
        expect(initMonitoring(' https://key@sentry.example/1 ', false)).toBe(true);
        const options = mockSentry.init.mock.calls[0][0] as InitOptions;
        expect(options).toMatchObject({
            dsn: 'https://key@sentry.example/1',
            environment: 'preview',
            sendDefaultPii: false,
            attachScreenshot: false,
            attachViewHierarchy: false,
            tracesSampleRate: 0,
        });
    });

    test('scrubs events and drops console breadcrumbs', () => {
        initMonitoring('https://key@sentry.example/1', false);
        const options = mockSentry.init.mock.calls[0][0] as InitOptions;
        const event = options.beforeSend({ message: 'booking for client@example.com failed', user: { id: 'u1', email: 'client@example.com' } });
        expect(JSON.stringify(event)).not.toContain('client@example.com');
        expect(event).toMatchObject({ user: { id: 'u1' } });
        expect(options.beforeBreadcrumb({ category: 'console', message: 'debug' })).toBeNull();
        const http = options.beforeBreadcrumb({ category: 'fetch', data: { url: 'https://api.example/rest/v1/profiles?phone=eq.%2B996555123456', 'http.query': 'phone=eq.%2B996555123456' } });
        expect(JSON.stringify(http)).not.toContain('996555123456');
    });

    test('logged errors become exceptions and logged warnings breadcrumbs', () => {
        initMonitoring('https://key@sentry.example/1', false);
        const error = new Error('boom');
        logError('ErrorBoundary', 'Caught an error', { error, componentStack: '\n    in Screen' });
        expect(mockSentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({ mechanism: { handled: true, type: 'logger' } }));
        logWarn('Booking', 'slow response');
        expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ category: 'Booking', level: 'warning', message: 'slow response' }));
    });
});
