import {
    createSentryReporter,
    maskLocation,
    normalizeRoute,
    safeBeforeSend,
    scrubBreadcrumb,
    scrubEvent,
    type SentryLike,
} from '@/lib/sentryMonitoring';

// ARCH-04: Sentry may only be turned on once nothing personal or secret can leave with an event.
function fakeSentry() {
    const root = { getScopeData: () => ({ transactionName: '' }) };
    let isolation: object = root;
    const scope = { setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() };
    const sentry = {
        isInitialized: jest.fn(() => true),
        getIsolationScope: jest.fn(() => isolation),
        withScope: jest.fn((callback: (value: typeof scope) => unknown) => callback(scope)),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
        addBreadcrumb: jest.fn(),
        flush: jest.fn(async () => true),
    };
    return {
        sentry,
        scope,
        reporter: (options: Parameters<typeof createSentryReporter>[1]) => createSentryReporter(sentry as unknown as SentryLike, options),
        enterRequest: (transactionName: string) => {
            isolation = { getScopeData: () => ({ transactionName }) };
        },
        leaveRequest: () => {
            isolation = root;
        },
    };
}

describe('Sentry reporter', () => {
    test('an Error is captured as an exception with the log scope tag', () => {
        const { sentry, scope, reporter } = fakeSentry();
        const report = reporter({ server: true });
        const error = new Error('boom');

        report({ level: 'error', scope: 'Booking', message: 'Request failed', extra: { error }, meta: { tags: { 'http.status_code': '500' } } });

        expect(sentry.captureException).toHaveBeenCalledWith(error, { mechanism: { handled: true, type: 'logger' } });
        expect(scope.setTag).toHaveBeenCalledWith('log.scope', 'Booking');
        expect(scope.setTag).toHaveBeenCalledWith('http.status_code', '500');
        expect(sentry.captureMessage).not.toHaveBeenCalled();
    });

    test('a PostgREST-like failure becomes a message grouped by its error code', () => {
        const { sentry, scope, reporter } = fakeSentry();
        reporter({ server: true })({ level: 'error', scope: 'S', message: 'm', extra: { error: { message: 'dup', code: '23505', details: 'x' } } });

        expect(scope.setFingerprint).toHaveBeenCalledWith(['S', 'm', '23505']);
        expect(sentry.captureMessage).toHaveBeenCalledWith('[S] m', 'error');
    });

    test('a warning only adds a breadcrumb, and on the server only inside a request', () => {
        const { sentry, reporter, enterRequest } = fakeSentry();
        const report = reporter({ server: true });

        report({ level: 'warn', scope: 'S', message: 'outside' });
        enterRequest('GET /api/x');
        report({ level: 'warn', scope: 'S', message: 'inside', extra: { phone: '+996555123456' } });

        expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
        expect(sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ category: 'S', level: 'warning', message: 'inside' }));
        expect(JSON.stringify(sentry.addBreadcrumb.mock.calls)).not.toContain('555123456');
        expect(sentry.captureException).not.toHaveBeenCalled();
        expect(sentry.captureMessage).not.toHaveBeenCalled();
    });

    test('five of six identical events in a window are sent; ids in the route do not split the budget', () => {
        const { sentry, reporter, enterRequest } = fakeSentry();
        const report = reporter({ server: false });
        for (let i = 0; i < 6; i += 1) {
            enterRequest(`GET /api/bookings/6f1c2a3b-1111-4222-8333-44445555${String(i).padStart(4, '0')}`);
            report({ level: 'error', scope: 'S', message: 'm' });
        }

        expect(sentry.captureMessage).toHaveBeenCalledTimes(5);
    });

    test('an API 5xx is reported once per request, and nothing happens when Sentry is not initialized', () => {
        const { sentry, reporter, enterRequest } = fakeSentry();
        const report = reporter({ server: true, scheduleFlush: (task) => void task() });
        enterRequest('POST /api/a');
        report({ level: 'error', scope: 'Route', message: 'API error', extra: { error: new Error('x') } });
        report({ level: 'error', scope: 'ApiErrorResponse', message: 'HTTP 500 internal', meta: { kind: 'api_response' } });
        enterRequest('POST /api/b');
        report({ level: 'error', scope: 'ApiErrorResponse', message: 'HTTP 500 internal', meta: { kind: 'api_response' } });

        expect(sentry.captureException).toHaveBeenCalledTimes(1);
        expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(sentry.flush).toHaveBeenCalledTimes(2);

        sentry.isInitialized.mockReturnValue(false);
        report({ level: 'error', scope: 'S', message: 'later' });
        expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    });
});

describe('event scrubbing', () => {
    test('request: no cookies, body or query; headers from an allow-list; URL without code and fragment', () => {
        const event = scrubEvent({
            request: {
                url: 'https://kezek.vercel.app/auth/callback?code=secret-code&next=%2Fcabinet#access_token=secret-token',
                cookies: { 'sb-auth-token': 'secret-cookie' },
                data: '{"password":"secret-body"}',
                query_string: 'code=secret-code',
                headers: { authorization: 'Bearer secret-jwt', cookie: 'a=b', 'user-agent': 'Mozilla', 'x-vercel-id': 'fra1::abc' },
            },
            user: { id: 'user-1', email: 'ada@example.kg', ip_address: '1.2.3.4' },
        }, { dropConsole: true });
        const text = JSON.stringify(event);

        expect(text).not.toMatch(/secret/);
        expect(event.request?.url).toContain('%5BREDACTED%5D');
        expect(event.request?.headers).toEqual({ 'user-agent': 'Mozilla', 'x-vercel-id': 'fra1::abc' });
        expect(event.user).toEqual({ id: 'user-1' });
    });

    test('messages, exception values, fingerprints, tags, transaction and extra are sanitized', () => {
        const event = scrubEvent({
            message: 'mail to ada@example.kg failed',
            exception: { values: [{ value: 'phone +996555123456 taken' }] },
            fingerprint: ['Mail', 'to ada@example.kg'],
            tags: { recipient: 'ada@example.kg', status: 500 },
            transaction: 'GET /api/bookings/6f1c2a3b-1111-4222-8333-444455556666/cancel?token=abc',
            extra: { phone: '+996555123456', nested: new Error('boom') },
            contexts: { nextjs: { request_path: '/auth/callback?code=secret-code' } },
        }, { dropConsole: true });
        const text = JSON.stringify(event);

        expect(text).not.toContain('ada@example.kg');
        expect(text).not.toContain('555123456');
        expect(text).not.toContain('secret-code');
        expect(event.transaction).toBe('GET /api/bookings/:id/cancel');
        expect((event.extra as { nested: { message: string } }).nested.message).toBe('boom');
    });

    test('breadcrumbs lose the PostgREST query; console breadcrumbs are dropped on the server only', () => {
        const http = { category: 'http', data: { url: 'https://x.supabase.co/rest/v1/staff?phone=eq.%2B996555123456', 'http.query': 'phone=eq.%2B996555123456', 'http.fragment': 'x', status_code: 200 } };
        const scrubbed = scrubBreadcrumb(http, { dropConsole: true });

        expect(JSON.stringify(scrubbed)).not.toContain('996555123456');
        expect(scrubbed?.data).not.toHaveProperty('http.query');
        expect(scrubbed?.data).toHaveProperty('status_code', 200);
        expect(scrubBreadcrumb({ category: 'console', message: 'x' }, { dropConsole: true })).toBeNull();
        expect(scrubBreadcrumb({ category: 'console', message: 'x' }, { dropConsole: false })).not.toBeNull();
    });

    test('spans lose query strings and fragments', () => {
        const event = scrubEvent({
            spans: [{ description: 'GET https://x.supabase.co/rest/v1/clients?email=eq.ada%40example.kg', data: { 'url.full': 'https://x.supabase.co/rest/v1/clients?email=eq.ada%40example.kg', 'url.query': 'email=eq.ada%40example.kg' } }],
        }, { dropConsole: true });

        expect(JSON.stringify(event)).not.toContain('ada%40example.kg');
        expect(event.spans?.[0].data).not.toHaveProperty('url.query');
    });

    test('a scrubbing failure means the event is not sent at all', () => {
        const hostile = {};
        Object.defineProperty(hostile, 'request', { get: () => { throw new Error('getter'); }, enumerable: true });

        expect(safeBeforeSend(hostile, { dropConsole: true })).toBeNull();
    });

    test('helpers: relative locations and route names', () => {
        expect(maskLocation('/auth/callback?code=abc&page=2#frag')).toBe('/auth/callback?code=%5BREDACTED%5D&page=2');
        expect(normalizeRoute('POST /api/staff/123/shift?x=1')).toBe('POST /api/staff/:n/shift');
    });
});
