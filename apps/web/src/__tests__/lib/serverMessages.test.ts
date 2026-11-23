import { NextResponse } from 'next/server';

import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { BizAccessError } from '@/lib/authDiagnostics';
import { rateLimitDeniedResponse } from '@/lib/rateLimit';
import { localizeApiResponse, requestLocale, serverDictionaries, translateServerMessage, withLocalizedMessages } from '@/lib/serverMessages';

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/cookies', () => ({ getLocaleFromCookieServer: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));

const { getLocaleFromCookieServer } = jest.requireMock('@/lib/cookies');
const { headers } = jest.requireMock('next/headers');
const { logError } = jest.requireMock('@/lib/log');

// FE-10: services answer in Russian; the response follows the language cookie of the request.
describe('server messages', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getLocaleFromCookieServer.mockResolvedValue(null);
        headers.mockResolvedValue(new Headers());
    });

    test('an exact message and a {placeholder} pattern are translated, Russian and unknown text are not', () => {
        expect(translateServerMessage('Доступ запрещен', 'ky')).toBe('Кирүү мүмкүн эмес');
        expect(translateServerMessage('Доступ запрещен', 'en')).toBe('Access denied');
        expect(translateServerMessage('Доступ запрещен', 'ru')).toBe('Доступ запрещен');
        expect(translateServerMessage('Превышен лимит запросов. Попробуйте через 30 секунд.', 'en'))
            .toBe('Too many requests. Try again in 30 seconds.');
        expect(translateServerMessage('Превышен лимит запросов. Попробуйте через 30 секунд.', 'ky'))
            .toBe('Суроо-талаптар өтө көп. 30 секунддан кийин кайра аракет кылыңыз.');
        expect(translateServerMessage('Совсем другое сообщение', 'en')).toBe('Совсем другое сообщение');
        expect(translateServerMessage('', 'en')).toBe('');
    });

    test('every dictionary message comes back translated, with the values of its placeholders in place', () => {
        // A sample value per placeholder; a pattern that another one shadows, or one without enough
        // fixed text, fails here.
        const fill = (text: string) => text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, name: string) => `V_${name}`);
        const wrong: string[] = [];
        for (const [key, ru] of Object.entries(serverDictionaries.ru)) {
            for (const locale of ['ky', 'en'] as const) {
                const expected = fill(serverDictionaries[locale][key]);
                const actual = translateServerMessage(fill(ru), locale);
                if (actual !== expected) wrong.push(`${locale} ${key}: ${actual}`);
            }
        }
        expect(wrong).toEqual([]);
        expect(Object.keys(serverDictionaries.ru).length).toBeGreaterThanOrEqual(16);
    });

    test('a JSON response gets its message and error translated, with its status, fields and headers', async () => {
        const original = NextResponse.json(
            { ok: false, error: 'Доступ запрещен', message: 'Нет доступа к этому бизнесу', details: { code: 'X' } },
            { status: 403, headers: { 'X-Trace': 'abc' } },
        );
        const response = await localizeApiResponse(original, 'en');

        expect(response).not.toBe(original);
        expect(response.status).toBe(403);
        expect(response.headers.get('X-Trace')).toBe('abc');
        expect(response.headers.get('content-type')).toContain('application/json');
        await expect(response.json()).resolves.toEqual({
            ok: false, error: 'Access denied', message: 'No access to this business', details: { code: 'X' },
        });
    });

    test('the messages of validation issues are translated, the rest of details stays', async () => {
        const original = NextResponse.json({
            ok: false,
            error: 'validation',
            message: 'Ошибка валидации',
            details: { errors: [{ path: 'phone', message: 'Доступ запрещен' }, { path: 'name', message: 'Другое' }, 'raw'], hint: 1 },
        }, { status: 400 });
        const response = await localizeApiResponse(original, 'en');

        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: 'validation',
            message: 'Validation error',
            details: { errors: [{ path: 'phone', message: 'Access denied' }, { path: 'name', message: 'Другое' }, 'raw'], hint: 1 },
        });
        const onlyIssues = await localizeApiResponse(NextResponse.json({ ok: false, error: 'validation', details: { errors: [{ path: 'x', message: 'Ресурс не найден' }] } }), 'ky');
        await expect(onlyIssues.json()).resolves.toEqual({ ok: false, error: 'validation', details: { errors: [{ path: 'x', message: 'Маалымат табылган жок' }] } });
    });

    test('without a known message, for Russian and for other bodies the same response comes back', async () => {
        const unknown = NextResponse.json({ ok: false, error: 'validation', message: 'Неизвестный текст' }, { status: 400 });
        const russian = NextResponse.json({ ok: false, message: 'Доступ запрещен' }, { status: 403 });
        const array = NextResponse.json(['Доступ запрещен']);
        const text = new Response('Доступ запрещен', { headers: { 'content-type': 'text/plain' } });

        expect(await localizeApiResponse(unknown, 'en')).toBe(unknown);
        expect(await localizeApiResponse(russian, 'ru')).toBe(russian);
        expect(await localizeApiResponse(array, 'en')).toBe(array);
        expect(await localizeApiResponse(text, 'en')).toBe(text);
        await expect(unknown.json()).resolves.toEqual({ ok: false, error: 'validation', message: 'Неизвестный текст' });

        // A big body is data: it is not translated, and it reaches the client whole.
        const rows = Array.from({ length: 3000 }, (_, i) => ({ id: i, name: 'Салон красоты' }));
        const big = NextResponse.json({ ok: false, message: 'Доступ запрещен', rows }, { status: 403 });
        expect(await localizeApiResponse(big, 'en')).toBe(big);
        await expect(big.json()).resolves.toEqual({ ok: false, message: 'Доступ запрещен', rows });
        const empty = new Response(null, { status: 204, headers: { 'content-type': 'application/json' } });
        expect(await localizeApiResponse(empty, 'en')).toBe(empty);
    });

    test('the cookie decides the language, and it is read only for a message the dictionaries know', async () => {
        getLocaleFromCookieServer.mockResolvedValue('ky');
        const known = await localizeApiResponse(NextResponse.json({ ok: false, message: 'Ресурс не найден' }, { status: 404 }));
        await expect(known.json()).resolves.toEqual({ ok: false, message: 'Маалымат табылган жок' });
        expect(getLocaleFromCookieServer).toHaveBeenCalledTimes(1);

        getLocaleFromCookieServer.mockClear();
        await localizeApiResponse(NextResponse.json({ ok: true, data: { name: 'Салон' } }));
        expect(getLocaleFromCookieServer).not.toHaveBeenCalled();

        getLocaleFromCookieServer.mockResolvedValue(null);
        const noCookie = NextResponse.json({ ok: false, message: 'Ресурс не найден' }, { status: 404 });
        expect(await localizeApiResponse(noCookie)).toBe(noCookie);

        getLocaleFromCookieServer.mockRejectedValue(new Error('outside a request'));
        const outside = NextResponse.json({ ok: false, message: 'Ресурс не найден' }, { status: 404 });
        expect(await localizeApiResponse(outside)).toBe(outside);
    });

    test('withErrorHandler answers in the language of the request and still reports a 5xx once', async () => {
        getLocaleFromCookieServer.mockResolvedValue('en');
        const returned = await withErrorHandler('Test', async () => createErrorResponse('internal', 'Внутренняя ошибка сервера', undefined, 500));
        const thrown = await withErrorHandler('Test', async () => {
            throw new BizAccessError('NO_BIZ_ACCESS', 'no access');
        });

        expect(returned.status).toBe(500);
        await expect(returned.json()).resolves.toEqual({ ok: false, error: 'internal', message: 'Internal server error' });
        expect(thrown.status).toBe(403);
        await expect(thrown.json()).resolves.toMatchObject({ error: 'forbidden', message: 'No access to this business' });
        expect(logError).toHaveBeenCalledTimes(1);
    });

    test('the rate limit answer and a wrapped handler are translated, and a nested wrapper keeps the result', async () => {
        const denied = await localizeApiResponse(rateLimitDeniedResponse({ success: false, limit: 5, remaining: 0, reset: 0, retryAfter: 42 }), 'en');
        expect(denied.status).toBe(429);
        expect(denied.headers.get('Retry-After')).toBe('42');
        await expect(denied.json()).resolves.toMatchObject({ error: 'rate_limit_exceeded', message: 'Too many requests. Try again in 42 seconds.' });

        getLocaleFromCookieServer.mockResolvedValue('ky');
        const handler = withLocalizedMessages(async (id: string) => NextResponse.json({ ok: false, message: 'Отсутствует ID сотрудника', id }, { status: 400 }));
        const first = await handler('s1');
        expect(await localizeApiResponse(first)).toBe(first);
        await expect(first.json()).resolves.toEqual({ ok: false, message: 'Кызматкердин ID көрсөтүлгөн жок', id: 's1' });
        expect(getLocaleFromCookieServer).toHaveBeenCalledTimes(1);
    });
    test('the language is the cookie, then the X-Kezek-Locale header of the mobile app, then Russian', async () => {
        headers.mockResolvedValue(new Headers({ 'x-kezek-locale': 'ky' }));
        await expect(requestLocale()).resolves.toBe('ky');
        const fromHeader = await localizeApiResponse(NextResponse.json({ ok: false, message: 'Доступ запрещен' }, { status: 403 }));
        await expect(fromHeader.json()).resolves.toEqual({ ok: false, message: 'Кирүү мүмкүн эмес' });

        getLocaleFromCookieServer.mockResolvedValue('en');
        await expect(requestLocale()).resolves.toBe('en');

        getLocaleFromCookieServer.mockResolvedValue(null);
        headers.mockResolvedValue(new Headers({ 'x-kezek-locale': ' EN ' }));
        await expect(requestLocale()).resolves.toBe('en');
        for (const invalid of ['de', 'ru-RU', '']) {
            headers.mockResolvedValue(new Headers({ 'x-kezek-locale': invalid }));
            await expect(requestLocale()).resolves.toBe('ru');
        }
        headers.mockResolvedValue(new Headers());
        await expect(requestLocale()).resolves.toBe('ru');
    });

    test('a cookie or header that cannot be read means Russian, never a failure', async () => {
        getLocaleFromCookieServer.mockRejectedValue(new Error('no cookies'));
        headers.mockResolvedValue(new Headers({ 'x-kezek-locale': 'ky' }));
        await expect(requestLocale()).resolves.toBe('ky');

        headers.mockRejectedValue(new Error('outside a request scope'));
        await expect(requestLocale()).resolves.toBe('ru');
    });
});
