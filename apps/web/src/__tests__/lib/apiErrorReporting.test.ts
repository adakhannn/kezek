import { NextResponse } from 'next/server';

import { alreadyReportedUnavailableResponse, createErrorResponse, featureDisabledResponse, handleApiError, withErrorHandler } from '@/lib/apiErrorHandler';

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

const { logError, logWarn } = jest.requireMock('@/lib/log');

// ARCH-04: a 5xx answer used to leave no trace unless the route logged by itself.
describe('API error reporting', () => {
    beforeEach(() => jest.clearAllMocks());

    test('createErrorResponse reports a 5xx once as an API response, and never a 4xx', () => {
        const response = createErrorResponse('service_unavailable', 'Try later', { retryAfter: 5 }, 503);
        createErrorResponse('validation', 'Bad input', undefined, 400);

        expect(response.status).toBe(503);
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith(
            'ApiErrorResponse',
            'HTTP 503 service_unavailable',
            { status: 503, error: 'service_unavailable', message: 'Try later', details: { retryAfter: 5 } },
            { kind: 'api_response', tags: { 'http.status_code': '503' } },
        );
    });

    test('a switched-off feature answers 503 without a Sentry error, also through withErrorHandler', async () => {
        const response = await withErrorHandler('Schedule', async () => featureDisabledResponse('Off'));

        expect(response.status).toBe(503);
        expect((await response.json()).error).toBe('service_unavailable');
        expect(logError).not.toHaveBeenCalled();
    });

    test('a 503 whose cause the caller already logged is not reported again (KEZEK-WEB-8)', async () => {
        const response = await withErrorHandler('Cron', async () => alreadyReportedUnavailableResponse('Cron execution tracking is unavailable'));

        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ ok: false, error: 'service_unavailable' });
        expect(logError).not.toHaveBeenCalled();
    });

    test('handleApiError logs a server failure with its cause and tags, a client error as a warning only', async () => {
        const cause = new Error('connection terminated');
        const serverFailure = handleApiError(cause, 'Bookings');
        const clientError = handleApiError(new Error('Invalid date'), 'Bookings');

        expect(serverFailure.status).toBe(500);
        expect(clientError.status).toBe(400);
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('Bookings', 'API error', { error: cause, status: 500 }, { tags: { 'http.status_code': '500' } });
        expect(logWarn).toHaveBeenCalledWith('Bookings', 'API client error', { status: 400, error: 'Invalid date' });
        // The status still comes from the text; English library text is not shown (ENG-47).
        await expect(clientError.json()).resolves.toEqual({ ok: false, error: 'validation', message: 'Ошибка валидации' });
    });

    test('withErrorHandler reports a handler-returned 5xx once, and a 2xx or an already reported 5xx not at all', async () => {
        await withErrorHandler('Silent', async () => NextResponse.json({ ok: false }, { status: 502 }));
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('Silent', 'HTTP 502 response', { status: 502 }, { kind: 'api_response', tags: { 'http.status_code': '502' } });

        jest.clearAllMocks();
        await withErrorHandler('Fine', async () => NextResponse.json({ ok: true }));
        await withErrorHandler('Reported', async () => createErrorResponse('internal', 'Failed', undefined, 500));
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('ApiErrorResponse', 'HTTP 500 internal', expect.anything(), expect.anything());
    });

    test('a broken logger never changes a response', async () => {
        logError.mockImplementation(() => {
            throw new Error('logger down');
        });
        logWarn.mockImplementation(() => {
            throw new Error('logger down');
        });

        const created = createErrorResponse('internal', 'Failed', undefined, 500);
        const handled = handleApiError(new Error('boom'), 'X');
        const client = handleApiError(new Error('not found here'), 'X');
        const wrapped = await withErrorHandler('X', async () => NextResponse.json({ ok: false }, { status: 503 }));

        expect([created.status, handled.status, client.status, wrapped.status]).toEqual([500, 500, 404, 503]);
        await expect(created.json()).resolves.toEqual({ ok: false, error: 'internal', message: 'Failed' });
    });

    test('the classification of today stays the same (status and body)', async () => {
        const table: Array<[unknown, number, string]> = [
            [new Error('UNAUTHORIZED'), 401, 'auth'],
            [new Error('forbidden zone'), 403, 'forbidden'],
            [new Error('invalid phone'), 400, 'validation'],
            [new Error('Booking not found'), 404, 'not_found'],
            [new Error('slot conflict'), 409, 'conflict'],
            [{ error: 'rate_limit', message: 'Slow down', status: 429 }, 429, 'rate_limit'],
            ['plain string failure', 500, 'internal'],
        ];
        for (const [input, status, error] of table) {
            const response = handleApiError(input, 'Table');
            expect(response.status).toBe(status);
            await expect(response.json()).resolves.toMatchObject({ ok: false, error });
        }
    });
});

// ARCH-05: the status came from the error text, so NO_BIZ_ACCESS answered 500 and an unavailable
// auth service ('AUTH_SERVICE_UNAVAILABLE' contains "auth") answered 401.
describe('typed error classification', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BizAccessError } = require('@/lib/authDiagnostics');

    test.each([
        [new BizAccessError('NO_BIZ_ACCESS'), 403, { ok: false, error: 'forbidden', details: { code: 'NO_BIZ_ACCESS' } }],
        [new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'), 401, { ok: false, error: 'auth', message: 'UNAUTHORIZED' }],
        [new BizAccessError('SERVICE_UNAVAILABLE', 'AUTH_SERVICE_UNAVAILABLE'), 503, { ok: false, error: 'service_unavailable' }],
    ])('access error %p → %i', async (error, status, body) => {
        const response = handleApiError(error, 'Access');
        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toMatchObject(body);
    });

    test.each([
        ['23505', 409, 'conflict'],
        ['23503', 409, 'conflict'],
        ['42501', 403, 'forbidden'],
        ['22P02', 400, 'validation'],
        ['23514', 400, 'validation'],
    ])('database code %s → %i without the database text', async (code, status, error) => {
        const response = handleApiError({ message: 'secret_table internals', code, details: null, hint: null }, 'Db');
        expect(response.status).toBe(status);
        const body = await response.json();
        expect(body).toMatchObject({ ok: false, error });
        expect(JSON.stringify(body)).not.toContain('secret_table');
    });

    test('other database errors keep the legacy text classification', () => {
        expect(handleApiError(Object.assign(new Error('Booking not found'), { code: 'P0001' }), 'Db').status).toBe(404);
        expect(handleApiError(Object.assign(new Error('deadlock detected'), { code: '40P01' }), 'Db').status).toBe(500);
    });
});
