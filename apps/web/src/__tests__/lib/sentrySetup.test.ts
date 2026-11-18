import { existsSync } from 'node:fs';
import path from 'node:path';

jest.mock('@sentry/nextjs', () => ({
    init: jest.fn(),
    httpIntegration: jest.fn((options: unknown) => ({ name: 'Http', options })),
    requestDataIntegration: jest.fn((options: unknown) => ({ name: 'RequestData', options })),
    isInitialized: jest.fn(() => false),
    getIsolationScope: jest.fn(() => ({})),
    withScope: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    flush: jest.fn(),
}));
jest.mock('next/server', () => ({ after: jest.fn() }));

const REPORTER_SLOT = Symbol.for('kezek.monitoring.reporter');
const slot = () => (globalThis as unknown as Record<symbol, unknown>)[REPORTER_SLOT];

function load(file: string, dsn: string | undefined) {
    const Sentry = jest.requireMock('@sentry/nextjs');
    Sentry.init.mockClear();
    (globalThis as unknown as Record<symbol, unknown>)[REPORTER_SLOT] = undefined;
    if (dsn) process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    else delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    jest.isolateModules(() => {
        require(file);
    });
    return Sentry.init.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
}

// ARCH-04: the browser SDK never started under Turbopack, and the server sent cookies, bodies and
// traces as soon as a DSN was set.
describe('Sentry setup', () => {
    const dsn = 'https://public@o0.ingest.sentry.io/0';
    afterAll(() => {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    test('the browser starts from instrumentation-client.ts; sentry.client.config.ts is gone', () => {
        const src = path.join(process.cwd(), 'src');
        expect(existsSync(path.join(src, 'instrumentation-client.ts'))).toBe(true);
        expect(existsSync(path.join(src, 'sentry.client.config.ts'))).toBe(false);
    });

    test('browser: errors only, no replay, scrubbing hooks, reporter only with a DSN', () => {
        expect(load('@/instrumentation-client', undefined)).toBeUndefined();
        expect(slot()).toBeUndefined();

        const options = load('@/instrumentation-client', dsn);
        expect(options).toMatchObject({ dsn, sendDefaultPii: false, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
        expect(options).not.toHaveProperty('tracesSampleRate');
        expect(options).not.toHaveProperty('environment');
        expect(options).not.toHaveProperty('integrations');
        expect(typeof options?.beforeSend).toBe('function');
        expect(typeof options?.beforeBreadcrumb).toBe('function');
        expect(typeof slot()).toBe('function');
    });

    test('server: no request bodies, cookies, query strings or IPs; no tracing', () => {
        const options = load('@/sentry.server.config', dsn);
        const Sentry = jest.requireMock('@sentry/nextjs');

        expect(options).toMatchObject({ sendDefaultPii: false });
        expect(options).not.toHaveProperty('tracesSampleRate');
        expect(options).not.toHaveProperty('environment');
        expect(Sentry.httpIntegration).toHaveBeenCalledWith({ disableIncomingRequestSpans: true, maxIncomingRequestBodySize: 'none' });
        expect(Sentry.requestDataIntegration).toHaveBeenCalledWith({ include: { cookies: false, data: false, query_string: false, ip: false } });
        const event = (options?.beforeSend as (event: unknown) => { request: Record<string, unknown> })({
            request: { cookies: { a: 'b' }, data: 'x', headers: { cookie: 'a=b', authorization: 'Bearer t' } },
        });
        expect(event.request).toEqual({ headers: {} });
        expect(typeof slot()).toBe('function');
    });

    test('edge: no tracing or environment override, scrubbing hooks set', () => {
        expect(load('@/sentry.edge.config', undefined)).toBeUndefined();
        const options = load('@/sentry.edge.config', dsn);

        expect(options).toMatchObject({ sendDefaultPii: false });
        expect(options).not.toHaveProperty('tracesSampleRate');
        expect(options).not.toHaveProperty('environment');
        expect(typeof options?.beforeSend).toBe('function');
    });
});
